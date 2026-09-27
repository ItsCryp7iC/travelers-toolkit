export const createGoalsSlice = (set, get) => ({
  goals: [],

  addGoal: (goal) =>
    set((state) => ({
      goals: [...state.goals.filter((g) => g.charName !== goal.charName), goal],
    })),

  removeGoal: (charName) =>
    set((state) => ({
      goals: state.goals.filter((g) => g.charName !== charName),
    })),
});
