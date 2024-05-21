
export class Category {
    displayName: string;
    key: CategoryOption;
    

    public static GetGategories(): Category[] {
        return [
            {
                displayName: "Custom",
                key: CategoryOption.Custom
            },
            {
                displayName: "No LTS",
                key: CategoryOption.NoLts
            },
            {
                displayName: "All Cells",
                key: CategoryOption.AllCells
            },
            {
                displayName: "100% (Beta)",
                key: CategoryOption.Hundo
            },
            {
                displayName: "No FCS",
                key: CategoryOption.NoFcs
            },
            {
                displayName: "Orbless",
                key: CategoryOption.Orbless
            },
            {
                displayName: "All Flies",
                key: CategoryOption.AllFlies
            },
            {
                displayName: "All Orbs (Beta)",
                key: CategoryOption.AllOrbs
            },
        ]
    }
}

export enum CategoryOption {
    Custom,
    NoLts,
    AllCells,
    Hundo,
    NoFcs,
    Orbless,
    AllFlies,
    AllOrbs
}