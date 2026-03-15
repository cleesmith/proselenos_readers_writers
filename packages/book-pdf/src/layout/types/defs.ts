import * as P from '../../vendor/primitives/index.js';
import { ClipPathNode, SafeClipPathNode } from './clip-path';
import { LinearGradientNode, SafeLinearGradientNode } from './linear-gradient';
import { RadialGradientNode, SafeRadialGradientNode } from './radial-gradient';

export type DefsNode = {
  type: typeof P.Defs;
  props?: never;
  style?: never;
  box?: never;
  origin?: never;
  yogaNode?: never;
  children?: (ClipPathNode | LinearGradientNode | RadialGradientNode)[];
};

export type Defs = Record<string, DefsNode['children'][number]>;

export type SafeDefsNode = Omit<DefsNode, 'children'> & {
  children?: (
    | SafeClipPathNode
    | SafeLinearGradientNode
    | SafeRadialGradientNode
  )[];
};

export type SafeDefs = Record<string, SafeDefsNode['children'][number]>;
