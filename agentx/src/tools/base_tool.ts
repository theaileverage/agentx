export abstract class BaseTool {
  abstract name: string;
  abstract description: string;

  abstract next(args: unknown): Promise<unknown>;
}

export type Tool = BaseTool;
