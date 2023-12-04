
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
                displayName: "100%",
                key: CategoryOption.Hundo
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
                displayName: "All Orbs",
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
    Orbless,
    AllFlies,
    AllOrbs
}