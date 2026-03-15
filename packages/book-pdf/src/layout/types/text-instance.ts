import * as P from '../../vendor/primitives/index.js';

export type TextInstanceNode = {
  type: typeof P.TextInstance;
  props?: never;
  style?: never;
  box?: never;
  origin?: never;
  children?: never[];
  yogaNode?: never;
  value: string;
};

export type SafeTextInstanceNode = TextInstanceNode;
