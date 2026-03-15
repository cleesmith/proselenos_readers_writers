import * as P from '../../vendor/primitives/index.js';
import { SafeStyle, Style } from '../../vendor/stylesheet/index.js';

import {
  Origin,
  SVGPresentationAttributes,
  SafeSVGPresentationAttributes,
} from './base';

interface CircleProps extends SVGPresentationAttributes {
  style?: SVGPresentationAttributes;
  cx?: string | number;
  cy?: string | number;
  r: string | number;
}

interface SafeCircleProps extends SafeSVGPresentationAttributes {
  style?: SafeSVGPresentationAttributes;
  cx?: number;
  cy?: number;
  r: number;
}

export type CircleNode = {
  type: typeof P.Circle;
  props: CircleProps;
  style?: Style | Style[];
  box?: never;
  origin?: Origin;
  yogaNode?: never;
  children?: never[];
};

export type SafeCircleNode = Omit<CircleNode, 'style' | 'props'> & {
  style: SafeStyle;
  props: SafeCircleProps;
};
