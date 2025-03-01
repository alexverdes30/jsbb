// Copyright (c) TotalSoft.
// This source code is licensed under the MIT license.

import { useStateLens, rmap, over } from '@totalsoft/react-state-lens'
import { useCallback, useState, useMemo } from 'react';
import { create, detectChanges, ensureArrayUIDsDeep } from '@totalsoft/change-tracking'

export function useChangeTrackingLens(initialModel) {
    const [dirtyInfo, setDirtyInfo] = useState(create)
    const stateLens = useStateLens(() => ensureArrayUIDsDeep(initialModel));
    const changeTrackingLens = useMemo(() =>
        stateLens |> rmap(
            (changedModel, prevModel) => {
                const newModel = ensureArrayUIDsDeep(changedModel)
                const newDirtyInfo = detectChanges(newModel, prevModel, dirtyInfo)
                setDirtyInfo(newDirtyInfo)
                return newModel;
            }),
        [stateLens])

    return [
        changeTrackingLens,
        dirtyInfo,

        // Reset
        useCallback((newModel = undefined) => {
            over(stateLens, (prevModel => {
                setDirtyInfo(create())
                return newModel !== undefined ? ensureArrayUIDsDeep(newModel) : prevModel
            }));
        }, [])
    ]
}