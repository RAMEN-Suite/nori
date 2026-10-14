export type ConfirmationMessage =
  | string
  | {
      readonly key: string;
      readonly params: Readonly<Record<string, string | undefined>>;
    };
