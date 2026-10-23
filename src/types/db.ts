import type * as schema from "@/db/schema";

export type { Accusation, NarrativeGrade, QuizQuestion, RubricPoint } from "@/db/schema";

export type CaseRating = (typeof schema.caseRating.enumValues)[number];
export type Case = typeof schema.cases.$inferSelect;
export type Location = typeof schema.locations.$inferSelect;
export type Suspect = typeof schema.suspects.$inferSelect;
export type Clue = typeof schema.clues.$inferSelect;
export type Breakpoint = typeof schema.breakpoints.$inferSelect;
export type PlaySession = typeof schema.playSessions.$inferSelect;
export type PlayMessage = typeof schema.playMessages.$inferSelect;
