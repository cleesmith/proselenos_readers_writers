import * as P from '../../vendor/primitives/index.js';
import { SafeStyle, Style } from '../../vendor/stylesheet/index.js';

import {
  SafeSVGPresentationAttributes,
  SVGPresentationAttributes,
} from './base';

interface PolygonProps extends SVGPresentationAttributes {
  style?: SVGPresentationAttributes;
  points: string;
}

interface SafePolygonProps extends SafeSVGPresentationAttributes {
  style?: SafeSVGPresentationAttributes;
  points: string;
}

export type PolygonNode = {
  type: typeof P.Polygon;
  props: PolygonProps;
  style?: Style | Style[];
  box?: never;
  origin?: never;
  yogaNode?: never;
  children?: never[];
};

export type SafePolygonNode = Omit<PolygonNode, 'style' | 'props'> & {
  style: SafeStyle;
  props: SafePolygonProps;
};
