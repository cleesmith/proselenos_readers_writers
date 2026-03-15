/// <reference types="node" />

type PDFFontSource = string | Buffer | Uint8Array | ArrayBuffer | any;
type Context = any;

declare const render: (ctx: Context, doc: any) => Context;

export { render as default };
