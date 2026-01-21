import { BaseCommentPlugin } from '@platejs/comment';

import { CommentLeafStatic } from '@/components/plate-ui/comment-node-static';

export const BaseCommentKit = [
  BaseCommentPlugin.withComponent(CommentLeafStatic),
];
