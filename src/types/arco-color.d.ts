declare module "@arco-design/color" {
  export function generate(
    color: string,
    options: { list: true; dark?: boolean },
  ): string[];
  export function getRgbStr(color: string): string;
}
