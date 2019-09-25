import Reader from "./fantasy/data/reader";
import { Validation } from "./validation";
import { AnyValidation } from "./anyValidation";
import { Validator } from "./validator";
import { $do, lift2, concat, map, contramap, merge } from "./fantasy/prelude";
import curry from "lodash.curry";

const successValidator = Validator.of(Validation.Success());

function allReducer(f1, f2) {
  return concat(f1, f2);
}

function variadicApply(variadicFn) {
  const res = function(...args) {
    if (args.length === 1 && Array.isArray(args[0])) {
      return variadicFn(...args[0]);
    }

    return variadicFn(...args);
  };
  res.toString = function() {
    return variadicFn.toString();
  };
  return res;
}

export const all = variadicApply(function all(...validators) {
  checkValidators(...validators);
  return validators.reduce(allReducerWithOptions);
});

export function allWithArray(validators) {
  return validators.reduce(allReducerWithOptions);
}

function allReducerWithOptions(f1, f2) {
  return $do(function*() {
    const [, ctx] = yield Reader.ask();
    if (ctx.abortEarly) {
      const v1 = yield f1;
      return !Validation.isValid(v1) ? Validator.of(v1) : allReducer(Validator.of(v1), f2);
    }
    return allReducer(f1, f2);
  });
}

function anyReducer(f1, f2) {
  return lift2(merge(AnyValidation.mergeStrategy), f1, f2);
}

function anyReducerWithOptions(f1, f2) {
  return $do(function*() {
    const [, ctx] = yield Reader.ask();
    if (ctx.abortEarly) {
      const v1 = yield f1;
      return Validation.isValid(v1) ? Validator.of(v1) : anyReducer(Validator.of(v1), f2);
    }
    return anyReducer(f1, f2);
  });
}

export const any = variadicApply(function any(...validators) {
  checkValidators(...validators);
  return validators.reduce(anyReducerWithOptions);
});

export const when = curry(function when(predicate, validator) {
  checkValidators(validator);
  return $do(function*() {
    const isTrue = yield Reader(predicate);
    return isTrue ? validator : successValidator;
  });
});

export function fromModel(validatorFactory) {
  return $do(function*() {
    const [model] = yield Reader.ask();
    if (model === null || model === undefined) {
      return successValidator;
    }
    const v = validatorFactory(model);
    checkValidators(v);
    return v;
  });
}

export function abortEarly(validator) {
  checkValidators(validator);
  return validator |> contramap((model, ctx) => [model, { ...ctx, abortEarly: true }]);
}

export function field(key, validator) {
  checkValidators(validator);
  return (
    validator
    |> _logFieldPath
    |> _filterFieldPath
    |> contramap((model, ctx) => [model[key], _getFieldContext(ctx, key)])
    |> map(_mapFieldToObjValidation(key))
  );
}

export function shape(validatorObj) {
  return $do(function*() {
    const [model] = yield Reader.ask();
    if (model === null || model === undefined) {
      return successValidator;
    }

    return Object.entries(validatorObj)
      .map(([k, v]) => field(k, v))
      .reduce(allReducer, successValidator);
  });
}

export function items(itemValidator) {
  checkValidators(itemValidator);
  return $do(function*() {
    const [items] = yield Reader.ask();
    if (items === null || items === undefined) {
      return successValidator;
    }
    return items.map((_, index) => field(index, itemValidator)).reduce(allReducer, successValidator);
  });
}

export const filterFields = curry(function filterFields(fieldFilter, validator) {
  checkValidators(validator);
  return validator |> contramap((model, context) => [model, { ...context, fieldFilter }]);
});

export const logTo = curry(function logTo(logger, validator) {
  checkValidators(validator);
  return validator |> contramap((model, context) => [model, { ...context, log: true, logger }]);
});

const _mapFieldToObjValidation = curry(function _mapFieldToObjValidation(key, validation) {
  const fields = { [key]: validation };
  return Validation.isValid(validation) ? Validation.Success() : Validation.Failure([], fields);
});

function _getFieldContext(context, key) {
  return { ...context, fieldPath: [...context.fieldPath, key] };
}

function _log(context, message) {
  if (context.log) {
    context.logger.log(message);
  }
}

function _logFieldPath(validator) {
  return $do(function*() {
    const [, fieldContext] = yield Reader.ask();
    const validation = yield validator;
    _log(fieldContext, `Validation ${Validation.isValid(validation) ? "succeded" : "failed"} for path ${fieldContext.fieldPath.join(".")}`);
    return Validator.of(validation);
  });
}

function _filterFieldPath(validator) {
  return $do(function*() {
    const [, fieldContext] = yield Reader.ask();
    return !fieldContext.fieldFilter(fieldContext.fieldPath) ? successValidator : validator;
  });
}

function checkValidators(...validators) {
  validators.forEach(function(validator) {
    if (!Validator.is(validator)) {
      throw new Error(`Value ${prettyPrint(validator)} is not a validator!`);
    }
  });
}

function prettyPrint(obj) {
  return typeof obj === "function" ? obj.toString() : JSON.stringify(obj);
}
