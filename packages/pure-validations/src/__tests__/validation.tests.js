import { Validation } from "../validation";
import { AllValidation } from "../allValidation";
import { concat } from "../polymorphicFns"
import fl from 'fantasy-land'
import { Monoid} from '../typeClasses'

function applyLaw(law) {
  return  (...args) => isEquivalent => law(isEquivalent)(...args)
}
function expectLawValid(lawEvaluator) {
  return lawEvaluator((a, b) => expect(a).toStrictEqual(b))
}

describe("validation tests suite:", () => {
  it("monoid left identity law: ", () => {
    // Arrange
    var failure = AllValidation(Validation.Failure(["err1", "err2"], {
      a: Validation.Failure(["errA"])
    }));

    // Act
    var lawEvaluator = applyLaw(Monoid.laws.leftIdentity)(failure);
    
    // Assert
    expectLawValid(lawEvaluator)
  });

  it("monoid right identity law: ", () => {
    // Arrange
    var identity = AllValidation[fl.empty]();
    var failure = AllValidation(Validation.Failure(["err1", "err2"], {
      a: Validation.Failure(["errA"])
    }));

    // Act
    var result = concat(failure, identity);

    // Assert
    expect(result).toStrictEqual(failure);
  });

  it("monoid associativity law: ", () => {
    // Arrange
    var failure1 = AllValidation(Validation.Failure(["err1"], {
      a: Validation.Failure(["errA1"])
    }));
    var failure2 = AllValidation(Validation.Failure(["err2"], {
      a: Validation.Failure(["errA2"])
    }));
    var failure3 = AllValidation(Validation.Failure(["err3"], {
      a: Validation.Failure(["errA3"])
    }));

    // Act
    var result1 = concat(concat(failure1, failure2), failure3);
    var result2 = concat(failure1, concat(failure2, failure3));

    // Assert
    expect(result1).toStrictEqual(result2);
  });

  it("get inner validation:", () => {
    // Arrange
    const errors = ["Err2", "Err1"];
    const innerValidation = Validation.Failure(errors);
    const validation = Validation.Failure([], {
      field1: Validation.Failure([], {
        field11: innerValidation
      })
    });

    var result = Validation.getInner(validation, ["field1", "field11"]);

    // Assert
    expect(result).toBe(innerValidation);
  });

  it("get inner validation should return success if path not found:", () => {
    // Arrange
    const errors = ["Err2", "Err1"];
    const innerValidation = Validation.Failure(errors);
    const validation = Validation.Failure([], {
      field1: Validation.Failure([], {
        field11: innerValidation
      })
    });

    var result = Validation.getInner(validation, ["notFoundField", "field11"]);

    // Assert
    expect(result).toBe(Validation.Success());
  });

  it("get errors on success should return empty array:", () => {
    // Arrange
    const validation = Validation.Success();

    var result = Validation.getErrors(validation);

    // Assert
    expect(result).toStrictEqual([]);
  });

  it("get errors:", () => {
    // Arrange
    const errors = ["Err2", "Err1"];
    const validation = Validation.Failure(errors);

    var result = Validation.getErrors(validation);

    // Assert
    expect(result).toStrictEqual(errors);
  });

  it("reference economy empty success: ", () => {
    // Arrange
    var success1 = Validation.Success();
    var success2 = Validation.Success();

    // Act
    var result = concat(AllValidation(success1), AllValidation(success2));

    // Assert
    expect(result.value).toBe(success1);
    expect(result.value).toBe(success2);
  });

  it("reference economy full: ", () => {
    // Arrange
    var failure1 = Validation.Failure(["err1"], {
      a: Validation.Failure(["errA1"], {
        aa: Validation.Failure(["errAA1", "errAA2"]),
        ab: Validation.Success()
      }),
      b: Validation.Success()
    });
    var failure2 = Validation.Failure(["err1"], {
      a: Validation.Failure(["errA1"], {
        aa: Validation.Failure(["errAA1", "errAA2"]),
        ab: Validation.Success()
      }),
      b: Validation.Success()
    });

    // Act
    var result = concat(AllValidation(failure1), AllValidation(failure2)).value;

    // Assert
    expect(result).toBe(failure1);
  });
});
