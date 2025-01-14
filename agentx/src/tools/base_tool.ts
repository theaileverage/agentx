export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  
  abstract execute(args: unknown): Promise<unknown>;
}
