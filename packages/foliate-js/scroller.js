const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const debounce = (f, wait, immediate) => {
    let timeout
    return (...args) => {
        const later = () => {
            timeout = null
            if (!immediate) f(...args)
        }
        const callNow = immediate && !timeout
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(later, wait)
        if (callNow) f(...args)
    }
}

const lerp = (min, max, x) => x * (max - min) + min
const easeOutQuad = x => 1 - (1 - x) * (1 - x)
const animate = (a, b, duration, ease, render) => new Promise(resolve => {
    let start
    const step = now => {
        if (document.hidden) {
            render(lerp(a, b, 1))
            return resolve()
        }
        start ??= now
        const fraction = Math.min(1, (now - start) / duration)
        render(lerp(a, b, ease(fraction)))
        if (fraction < 1) requestAnimationFrame(step)
        else resolve()
    }
    if (document.hidden) {
        render(lerp(a, b, 1))
        return resolve()
    }
    requestAnimationFrame(step)
})

// collapsed range doesn't return client rects sometimes (or always?)
// try make get a non-collapsed range or element
const uncollapse = range => {
    if (!range?.collapsed) return range
    const { endOffset, endContainer } = range
    if (endContainer.nodeType === 1) {
        const node = endContainer.childNodes[endOffset]
        if (node?.nodeType === 1) return node
        return endContainer
    }
    if (endOffset + 1 < endContainer.length) range.setEnd(endContainer, endOffset + 1)
    else if (endOffset > 1) range.setStart(endContainer, endOffset - 1)
    else return endContainer.parentNode
    return range
}

const makeRange = (doc, node, start, end = start) => {
    const range = doc.createRange()
    range.setStart(node, start)
    range.setEnd(node, end)
    return range
}

// use binary search to find an offset value in a text node
const bisectNode = (doc, node, cb, start = 0, end = node.nodeValue.length) => {
    if (end - start === 1) {
        const result = cb(makeRange(doc, node, start), makeRange(doc, node, end))
        return result < 0 ? start : end
    }
    const mid = Math.floor(start + (end - start) / 2)
    const result = cb(makeRange(doc, node, start, mid), makeRange(doc, node, mid, end))
    return result < 0 ? bisectNode(doc, node, cb, start, mid)
        : result > 0 ? bisectNode(doc, node, cb, mid, end) : mid
}

const { SHOW_ELEMENT, SHOW_TEXT, SHOW_CDATA_SECTION,
    FILTER_ACCEPT, FILTER_REJECT, FILTER_SKIP } = NodeFilter

const filter = SHOW_ELEMENT | SHOW_TEXT | SHOW_CDATA_SECTION

// needed cause there seems to be a bug in `getBoundingClientRect()` in Firefox
// where it fails to include rects that have zero width and non-zero height
// (CSSOM spec says "rectangles [...] of which the height or width is not zero")
// which makes the visible range include an extra space at column boundaries
const getBoundingClientRect = target => {
    let top = Infinity, right = -Infinity, left = Infinity, bottom = -Infinity
    for (const rect of target.getClientRects()) {
        left = Math.min(left, rect.left)
        top = Math.min(top, rect.top)
        right = Math.max(right, rect.right)
        bottom = Math.max(bottom, rect.bottom)
    }
    return new DOMRect(left, top, right - left, bottom - top)
}

const getVisibleRange = (doc, start, end, mapRect) => {
    // first get all visible nodes
    const acceptNode = node => {
        const name = node.localName?.toLowerCase()
        // ignore all scripts, styles, and their children
        if (name === 'script' || name === 'style') return FILTER_REJECT
        if (node.nodeType === 1) {
            const { left, right } = mapRect(node.getBoundingClientRect())
            // no need to check child nodes if it's completely out of view
            if (right < start || left > end) return FILTER_REJECT
            // elements must be completely in view to be considered visible
            // because you can't specify offsets for elements
            if (left >= start && right <= end) return FILTER_ACCEPT
            // TODO: it should probably allow elements that do not contain text
            // because they can exceed the whole viewport in both directions
            // especially in scrolled mode
        } else {
            // ignore empty text nodes
            if (!node.nodeValue?.trim()) return FILTER_SKIP
            // create range to get rect
            const range = doc.createRange()
            range.selectNodeContents(node)
            const { left, right } = mapRect(range.getBoundingClientRect())
            // it's visible if any part of it is in view
            if (right >= start && left <= end) return FILTER_ACCEPT
        }
        return FILTER_SKIP
    }
    const walker = doc.createTreeWalker(doc.body, filter, { acceptNode })
    const nodes = []
    for (let node = walker.nextNode(); node; node = walker.nextNode())
        nodes.push(node)

    // we're only interested in the first and last visible nodes
    const from = nodes[0] ?? doc.body
    const to = nodes[nodes.length - 1] ?? from

    // find the offset at which visibility changes
    const startOffset = from.nodeType === 1 ? 0
        : bisectNode(doc, from, (a, b) => {
            const p = mapRect(getBoundingClientRect(a))
            const q = mapRect(getBoundingClientRect(b))
            if (p.right < start && q.left > start) return 0
            return q.left > start ? -1 : 1
        })
    const endOffset = to.nodeType === 1 ? 0
        : bisectNode(doc, to, (a, b) => {
            const p = mapRect(getBoundingClientRect(a))
            const q = mapRect(getBoundingClientRect(b))
            if (p.right < end && q.left > end) return 0
            return q.left > end ? -1 : 1
        })

    const range = doc.createRange()
    range.setStart(from, startOffset)
    range.setEnd(to, endOffset)
    return range
}

const setSelectionTo = (target, collapse) => {
    let range
    if (target.startContainer) range = target.cloneRange()
    else if (target.nodeType) {
        range = document.createRange()
        range.selectNode(target)
    }
    if (range) {
        const sel = range.startContainer.ownerDocument?.defaultView.getSelection()
        if (sel) {
            sel.removeAllRanges()
            if (collapse === -1) range.collapse(true)
            else if (collapse === 1) range.collapse()
            sel.addRange(range)
        }
    }
}

const getDirection = doc => {
    const { defaultView } = doc
    const { writingMode, direction } = defaultView.getComputedStyle(doc.body)
    const vertical = writingMode === 'vertical-rl'
        || writingMode === 'vertical-lr'
    const rtl = doc.body.dir === 'rtl'
        || direction === 'rtl'
        || doc.documentElement.dir === 'rtl'
    return { vertical, rtl }
}

const getBackground = doc => {
    const bodyStyle = doc.defaultView.getComputedStyle(doc.body)
    return bodyStyle.backgroundColor === 'rgba(0, 0, 0, 0)'
        && bodyStyle.backgroundImage === 'none'
        ? doc.defaultView.getComputedStyle(doc.documentElement).background
        : bodyStyle.background
}

const setStylesImportant = (el, styles) => {
    const { style } = el
    for (const [k, v] of Object.entries(styles)) style.setProperty(k, v, 'important')
}

class View {
    #observer = new ResizeObserver(() => this.expand())
    #element = document.createElement('div')
    #iframe = document.createElement('iframe')
    #overlayer
    #vertical = false
    #layout = {}
    constructor({ container, onExpand }) {
        this.container = container
        this.onExpand = onExpand
        this.#iframe.setAttribute('part', 'filter')
        this.#element.append(this.#iframe)
        // viewport-sized container
        Object.assign(this.#element.style, {
            boxSizing: 'border-box',
            position: 'relative',
            width: '100%', height: '100%',
        })
        // iframe fills container, scrolls internally
        Object.assign(this.#iframe.style, {
            border: '0',
            display: 'none',
            width: '100%', height: '100%',
        })
        // `allow-scripts` is needed for events because of WebKit bug
        // https://bugs.webkit.org/show_bug.cgi?id=218086
        this.#iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')
    }
    get element() {
        return this.#element
    }
    get document() {
        return this.#iframe.contentDocument
    }
    async load(src, data, afterLoad, beforeRender) {
        if (typeof src !== 'string') throw new Error(`${src} is not string`)
        return new Promise(resolve => {
            this.#iframe.addEventListener('load', () => {
                const doc = this.document
                afterLoad?.(doc)

                this.#iframe.setAttribute('aria-label', doc.title)
                // it needs to be visible for Firefox to get computed style
                this.#iframe.style.display = 'block'
                const { vertical, rtl } = getDirection(doc)
                this.docBackground = getBackground(doc)
                doc.body.style.background = 'none'
                const background = this.docBackground
                this.#iframe.style.display = 'none'

                this.#vertical = vertical

                const layout = beforeRender?.({ vertical, rtl, background })
                this.#iframe.style.display = 'block'
                this.render(layout)
                this.#observer.observe(doc.body)

                // the resize observer above doesn't work in Firefox
                // (see https://bugzilla.mozilla.org/show_bug.cgi?id=1832939)
                // until the bug is fixed we can at least account for font load
                doc.fonts.ready.then(() => this.expand())

                resolve()
            }, { once: true })
            if (data) {
                this.#iframe.srcdoc = data
            } else {
                this.#iframe.src = src
            }
        })
    }
    render(layout) {
        if (!layout || !this.document) return
        this.#layout = layout
        this.scrolled(layout)
    }
    scrolled({ marginTop, marginRight, marginBottom, marginLeft, gap, columnWidth }) {
        const vertical = this.#vertical
        const doc = this.document
        setStylesImportant(doc.documentElement, {
            'box-sizing': 'border-box',
            'padding': vertical
                ? `${marginTop}px ${gap}px ${marginBottom}px ${gap}px`
                : `0px ${gap / 2 + marginRight}px 0px ${gap / 2 + marginLeft}px`,
            'column-width': 'auto',
            'height': 'auto',
            'width': 'auto',
        })
        setStylesImportant(doc.body, {
            [vertical ? 'max-height' : 'max-width']: `${columnWidth}px`,
            'margin': 'auto',
            'position': 'relative',
        })
        this.onExpand()
    }
    expand() {
        if (!this.document) return
        if (this.#overlayer) {
            const scrollH = this.document.documentElement.scrollHeight
            const scrollW = this.document.documentElement.scrollWidth
            this.#overlayer.element.style.height = `${scrollH}px`
            this.#overlayer.element.style.width = `${scrollW}px`
            this.#overlayer.redraw()
        }
        this.onExpand()
    }
    set overlayer(overlayer) {
        this.#overlayer = overlayer
        // inject into the iframe's document body so it scrolls with content
        this.document.body.append(overlayer.element)
    }
    get overlayer() {
        return this.#overlayer
    }
    destroy() {
        if (this.document) this.#observer.unobserve(this.document.body)
    }
}

// NOTE: everything here assumes the so-called "negative scroll type" for RTL
export class Scroller extends HTMLElement {
    static observedAttributes = [
        'flow', 'gap', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
        'max-inline-size', 'max-block-size',
    ]
    #root = this.attachShadow({ mode: 'open' })
    #observer = new ResizeObserver(() => this.render())
    #top
    #container
    #view
    #vertical = false
    #rtl = false
    #marginTop = 0
    #marginBottom = 0
    #index = -1
    #anchor = 0 // anchor view to a fraction (0-1), Range, or Element
    #justAnchored = false
    #locked = false // while true, prevent any further navigation
    #styles
    #styleMap = new WeakMap()
    constructor() {
        super()
        this.#root.innerHTML = `<style>
        :host {
            display: block;
            box-sizing: border-box;
            position: relative;
            width: 100%;
            height: 100%;
        }
        #top {
            --_gap: 7%;
            --_margin-top: 48px;
            --_margin-right: 48px;
            --_margin-bottom: 48px;
            --_margin-left: 48px;
            --_max-inline-size: 720px;
            --_max-block-size: 1440px;
            box-sizing: border-box;
            position: relative;
            width: 100%;
            height: 100%;
        }
        #container {
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        </style>
        <div id="top">
            <div id="container" part="container"></div>
        </div>
        `

        this.#top = this.#root.getElementById('top')
        this.#container = this.#root.getElementById('container')

        this.#observer.observe(this.#container)

        this.addEventListener('relocate', ({ detail }) => {
            if (detail.reason === 'selection') setSelectionTo(this.#anchor, 0)
            else if (detail.reason === 'navigation') {
                if (this.#anchor === 1) setSelectionTo(detail.range, 1)
                else if (typeof this.#anchor === 'number')
                    setSelectionTo(detail.range, -1)
                else setSelectionTo(this.#anchor, -1)
            }
        })
    }
    attributeChangedCallback(name, _, value) {
        switch (name) {
            case 'flow':
                this.render()
                break
            case 'gap':
            case 'margin-top':
            case 'margin-bottom':
            case 'margin-left':
            case 'margin-right':
            case 'max-block-size':
                this.#top.style.setProperty('--_' + name, value)
                this.render()
                break
            case 'max-inline-size':
                this.#top.style.setProperty('--_' + name, value)
                this.render()
                break
        }
    }
    open(book) {
        this.bookDir = book.dir
        this.sections = book.sections
        book.transformTarget?.addEventListener('data', ({ detail }) => {
            if (detail.type !== 'text/css') return
            detail.data = Promise.resolve(detail.data).then(data => data
                // unprefix as most of the props are (only) supported unprefixed
                .replace(/(?<=[{\s;])-epub-/gi, ''))
        })
    }
    #createView() {
        if (this.#view) {
            this.#view.destroy()
            this.#container.removeChild(this.#view.element)
        }
        this.#view = new View({
            container: this,
            onExpand: () => this.#scrollToAnchor(this.#anchor),
        })
        this.#container.append(this.#view.element)
        return this.#view
    }
    #beforeRender({ vertical, rtl, background }) {
        this.#vertical = vertical
        this.#rtl = rtl
        this.#top.classList.toggle('vertical', vertical)
        // FIXME: vertical-rl only, not -lr
        this.setAttribute('dir', vertical ? 'rtl' : 'ltr')

        const style = getComputedStyle(this.#top)
        const maxInlineSize = parseFloat(style.getPropertyValue('--_max-inline-size'))
        const marginTop = parseFloat(style.getPropertyValue('--_margin-top'))
        const marginRight = parseFloat(style.getPropertyValue('--_margin-right'))
        const marginBottom = parseFloat(style.getPropertyValue('--_margin-bottom'))
        const marginLeft = parseFloat(style.getPropertyValue('--_margin-left'))
        this.#marginTop = marginTop
        this.#marginBottom = marginBottom
        const g = parseFloat(style.getPropertyValue('--_gap')) / 100
        const { width, height } = this.#container.getBoundingClientRect()
        const size = vertical ? height : width

        return {
            flow: 'scrolled',
            marginTop, marginRight, marginBottom, marginLeft,
            gap: g * size,
            columnWidth: maxInlineSize,
        }
    }
    render() {
        if (!this.#view) return
        this.#view.render(this.#beforeRender({
            vertical: this.#vertical,
            rtl: this.#rtl,
            background: this.#view.docBackground,
        }))
        this.#scrollToAnchor(this.#anchor)
    }
    get scrolled() {
        return true
    }
    get scrollProp() {
        return this.#vertical ? 'scrollLeft' : 'scrollTop'
    }
    get sideProp() {
        return this.#vertical ? 'width' : 'height'
    }
    get size() {
        // Viewport size (what is visible inside iframe)
        const win = this.#view?.document?.defaultView
        return win ? (this.#vertical ? win.innerWidth : win.innerHeight) : 0
    }
    get viewSize() {
        // Total scrollable content height
        const doc = this.#view?.document
        return doc ? doc.documentElement[this.#vertical ? 'scrollWidth' : 'scrollHeight'] : 0
    }
    get start() {
        const win = this.#view?.document?.defaultView
        return win ? Math.abs(win[this.#vertical ? 'scrollX' : 'scrollY']) : 0
    }
    get end() {
        return this.start + this.size
    }
    get containerPosition() {
        return this.start
    }
    set containerPosition(val) {
        const win = this.#view?.document?.defaultView
        if (win) {
            if (this.#vertical) win.scrollTo(val, 0)
            else win.scrollTo(0, val)
        }
    }
    // allows one to process rects as if they were LTR and horizontal
    #getRectMapper() {
        const win = this.#view?.document?.defaultView
        if (!win) return f => f
        if (this.#vertical) {
            return ({ left, right }) => ({
                left: left + win.scrollX,
                right: right + win.scrollX,
            })
        }
        return ({ top, bottom }) => ({
            left: top + win.scrollY,
            right: bottom + win.scrollY,
        })
    }
    async #scrollTo(offset, reason, smooth) {
        const win = this.#view?.document?.defaultView
        if (!win) return
        const current = this.start
        if (Math.abs(current - offset) < 1) {
            this.#afterScroll(reason)
            return
        }
        if (smooth && this.hasAttribute('animated') && !this.hasAttribute('eink')) {
            return animate(current, offset, 300, easeOutQuad,
                x => { if (this.#vertical) win.scrollTo(x, 0); else win.scrollTo(0, x) }
            ).then(() => this.#afterScroll(reason))
        } else {
            if (this.#vertical) win.scrollTo(offset, 0)
            else win.scrollTo(0, offset)
            this.#afterScroll(reason)
        }
    }
    async scrollToAnchor(anchor, select) {
        return this.#scrollToAnchor(anchor, select ? 'selection' : 'navigation')
    }
    async #scrollToAnchor(anchor, reason = 'anchor') {
        this.#anchor = anchor
        const doc = this.#view?.document
        const win = doc?.defaultView
        if (!doc || !win) return

        const rects = uncollapse(anchor)?.getClientRects?.()
        if (rects) {
            const rect = Array.from(rects)
                .find(r => r.width > 0 && r.height > 0) || rects[0]
            if (!rect) return
            const offset = (this.#vertical ? rect.left + win.scrollX : rect.top + win.scrollY)
            await this.#scrollTo(offset, reason)
            if (reason === 'navigation') {
                let node = anchor.focus ? anchor : undefined
                if (!node && anchor.startContainer) {
                    node = anchor.startContainer
                    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
                }
                if (node?.focus) {
                    node.tabIndex = -1
                    node.style.outline = 'none'
                    node.focus({ preventScroll: true })
                }
            }
            return
        }
        // fraction anchor
        if (typeof anchor === 'number') {
            const scrollableHeight = Math.max(0, this.viewSize - this.size)
            await this.#scrollTo(anchor * scrollableHeight, reason)
        }
    }
    #getVisibleRange() {
        const doc = this.#view?.document
        if (!doc) return null
        return getVisibleRange(doc, this.start, this.end, this.#getRectMapper())
    }
    #afterScroll(reason) {
        const range = this.#getVisibleRange()
        if (!range) return
        if (reason !== 'selection' && reason !== 'navigation' && reason !== 'anchor')
            this.#anchor = range
        else this.#justAnchored = true

        const index = this.#index
        const scrollable = this.viewSize - this.size
        const fraction = scrollable > 0 ? this.start / scrollable : 0
        this.dispatchEvent(new CustomEvent('relocate', {
            detail: { reason, range, index, fraction }
        }))
    }
    async #display(promise) {
        const { index, src, data, anchor, onLoad, select } = await promise
        this.#index = index
        const hasFocus = this.#view?.document?.hasFocus()
        if (src) {
            const view = this.#createView()
            const afterLoad = doc => {
                if (doc.head) {
                    const $styleBefore = doc.createElement('style')
                    doc.head.prepend($styleBefore)
                    const $style = doc.createElement('style')
                    doc.head.append($style)
                    this.#styleMap.set(doc, [$styleBefore, $style])
                }
                onLoad?.({ doc, index })
            }
            const beforeRender = this.#beforeRender.bind(this)
            await view.load(src, data, afterLoad, beforeRender)
            this.dispatchEvent(new CustomEvent('create-overlayer', {
                detail: {
                    doc: view.document, index,
                    attach: overlayer => view.overlayer = overlayer,
                },
            }))
            this.#view = view
            // attach scroll listeners to iframe's contentWindow
            const win = view.document.defaultView
            if (win) {
                win.addEventListener('scroll', () => this.dispatchEvent(new Event('scroll')))
                win.addEventListener('scroll', debounce(() => {
                    if (this.#justAnchored) this.#justAnchored = false
                    else this.#afterScroll('scroll')
                }, 250))
            }
        }
        await this.scrollToAnchor((typeof anchor === 'function'
            ? anchor(this.#view.document) : anchor) ?? 0, select)
        if (hasFocus) this.focusView()
    }
    #canGoToIndex(index) {
        return index >= 0 && index <= this.sections.length - 1
    }
    async #goTo({ index, anchor, select }) {
        if (index === this.#index) await this.#display({ index, anchor, select })
        else {
            const oldIndex = this.#index
            const onLoad = detail => {
                this.sections[oldIndex]?.unload?.()
                this.setStyles(this.#styles)
                this.dispatchEvent(new CustomEvent('load', { detail }))
            }
            await this.#display(Promise.resolve(this.sections[index].load())
                .then(async src => {
                    const data = await this.sections[index].loadContent?.()
                    return { index, src, data, anchor, onLoad, select }
                }).catch(e => {
                    console.warn(e)
                    console.warn(new Error(`Failed to load section ${index}`))
                    return {}
                }))
        }
    }
    async goTo(target) {
        if (this.#locked) return
        const resolved = await target
        if (this.#canGoToIndex(resolved.index)) return this.#goTo(resolved)
    }
    #scrollPrev(distance) {
        if (!this.#view) return true
        if (this.start > 0) return this.#scrollTo(
            Math.max(0, this.start - (distance ?? this.size)), null, true)
        return !this.atStart
    }
    #scrollNext(distance) {
        if (!this.#view) return true
        const maxScroll = this.viewSize - this.size
        if (this.start < maxScroll - 2) return this.#scrollTo(
            Math.min(maxScroll, distance ? this.start + distance : this.end), null, true)
        return !this.atEnd
    }
    get atStart() {
        return this.#adjacentIndex(-1) == null && this.start <= 1
    }
    get atEnd() {
        return this.#adjacentIndex(1) == null && this.start >= this.viewSize - this.size - 2
    }
    #adjacentIndex(dir) {
        for (let index = this.#index + dir; this.#canGoToIndex(index); index += dir)
            if (this.sections[index]?.linear !== 'no') return index
    }
    async #turnPage(dir, distance) {
        if (this.#locked) return
        this.#locked = true
        const prev = dir === -1
        const shouldGo = await (prev ? this.#scrollPrev(distance) : this.#scrollNext(distance))
        if (shouldGo) await this.#goTo({
            index: this.#adjacentIndex(dir),
            anchor: prev ? () => 1 : () => 0,
        })
        if (shouldGo || !this.hasAttribute('animated')) await wait(100)
        this.#locked = false
    }
    async prev(distance) {
        return await this.#turnPage(-1, distance)
    }
    async next(distance) {
        return await this.#turnPage(1, distance)
    }
    prevSection() {
        return this.goTo({ index: this.#adjacentIndex(-1) })
    }
    nextSection() {
        return this.goTo({ index: this.#adjacentIndex(1) })
    }
    firstSection() {
        const index = this.sections.findIndex(section => section.linear !== 'no')
        return this.goTo({ index })
    }
    lastSection() {
        const index = this.sections.findLastIndex(section => section.linear !== 'no')
        return this.goTo({ index })
    }
    getContents() {
        if (this.#view) return [{
            index: this.#index,
            overlayer: this.#view.overlayer,
            doc: this.#view.document,
        }]
        return []
    }
    setStyles(styles) {
        this.#styles = styles
        const $$styles = this.#styleMap.get(this.#view?.document)
        if (!$$styles) return
        const [$beforeStyle, $style] = $$styles
        if (Array.isArray(styles)) {
            const [beforeStyle, style] = styles
            $beforeStyle.textContent = beforeStyle
            $style.textContent = style
        } else $style.textContent = styles
        this.#view?.document?.fonts?.ready?.then(() => this.#view.expand())
    }
    focusView() {
        this.#view.document.defaultView.focus()
    }
    destroy() {
        this.#observer.unobserve(this)
        this.#view.destroy()
        this.#view = null
        this.sections[this.#index]?.unload?.()
    }
}

customElements.define('foliate-scroller', Scroller)
