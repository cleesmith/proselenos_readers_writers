import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElementStatic } from '@/components/plate-ui/callout-node-static';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
];
