export type PageCursor = Readonly<{ createdAt: string; id: string }>;

export type PageRequest = Readonly<{ limit: number; cursor?: PageCursor }>;
