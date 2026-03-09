declare module '*.css' {
  interface IClassNames {
    [className: string]: string;
  }
  const classNames: IClassNames;
  export default classNames;
}

declare module 'pagedjs' {
  export class Previewer {
    preview(
      content: string,
      stylesheets: Array<{ raw: string } | { url: string }>,
      renderTo: HTMLElement
    ): Promise<unknown>;
  }
}
