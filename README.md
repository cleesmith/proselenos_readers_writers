# EverythingEbooks

**Read and Write Ebooks. All in your browser.**

**[everythingebooks.org](https://www.everythingebooks.org/)**

EverythingEbooks is a free ebook reader and writing workspace that runs entirely in your web browser. <br />No accounts. No subscriptions. No tracking. Your books and manuscripts stay on your computer.

---

## For Readers

Your personal ebook library with complete control over how you read.

- **Reading Essentials** — Highlight passages, bookmark pages, take notes, and search across your entire library
- **Make It Yours** — Adjust fonts, layouts, and colors to create your perfect reading environment
- **Smart Tools** — Look up words with the built-in dictionary or explore topics with Wikipedia integration
- **Read Aloud** — Listen to your books with AI-powered text-to-speech
- **Parallel Reading** — Read two books side by side with synchronized navigation

Click "**+Ebook**" to add your EPUB files and start reading.

---

## For Authors

**EPUB all the way down.** Your ebook is your manuscript.

Write directly in EPUB format from the start. No converting, no exporting, no formatting headaches. <br />
What you write is what readers get.

### The Writing Workspace

- **Start Fresh** — Create a new blank ebook, or import an existing EPUB or Word document
- **Organized by Chapters** — Front matter, numbered chapters, back matter - all in plain text
- **Always Export-Ready** — Send your ebook to the Library instantly for reading and listening

### AI Assistance (__Optional__)

If you want AI help, connect your own [OpenRouter](https://openrouter.ai) API key (__stored in your browser__) to access models from: <br /> 
Anthropic, OpenAI, Google, and more.

**AI Editing:**
- Line editing with suggestions
- Content analysis for character, plot, and pacing
- Custom prompts for your specific needs

**AI Writing:**
- Brainstorm characters, plots, and settings
- Generate outlines and story structures
- Build your world from your outline
- Draft chapters that know what came before

*Note: AI features require an OpenRouter account. Usage is pay-as-you-go based on the model you choose.*

---

## Getting Started

## Visit [everythingebooks.org](https://www.everythingebooks.org/)

### Readers
2. Click "**+Ebook**" to add EPUB files
3. Start reading

### Authors
1. Click "**Authors**"
2. Start writing and add chapters, front matter, back matter, no matter (inside author's head)
1. Click "**Open**" to select other ways to start
3. For AI features: <br/>
**Menu** > **Key** to add your OpenRouter API key, <br/>
then **Menu** > **Models** to choose your AI

---

## Privacy First

- **Everything stays local** — Your ebooks (_manuscripts_) are stored in your browser, on your computer
- **No accounts needed** — No sign up, no sign in, no emails
- **No tracking** — What you read and write is your business
- **Nothing uploaded** — The only exception is when you choose to use AI features, which sends manuscript text to an AI Model at OpenRouter

---

## Free Forever & Open Source

No subscriptions. No hidden fees. No premium tiers.

**Enjoy writing!**

---
---

# Run Everything Ebooks on Your Computer Totally Offline                                                          
                                                                                                       
## What You'll Need                                                                                     
                                                                                                   
1. Node.js - Download and install from https://nodejs.org                                            
2. pnpm - After installing Node.js, 
	open Terminal (Mac) or Command Prompt (Windows) and type:        
```npm install -g pnpm```
                                                                                                   
## Setup (One Time)                                                                                     
                                                                                                   
1. Download this project as a ZIP file from GitHub and unzip it                                      
2. Open Terminal/Command Prompt and navigate to that folder:                                         
cd path/to/everything-ebooks                                                                         
3. Run these commands (one at a time):                                                               
```	
pnpm install
pnpm build
```
                                                                                                   
## Launch the App                                                                                       
                                                                                                   
```pnpm start```
                                                                                                   
Then open your browser to http://localhost:3000                                                      
                                                                                                   
Keep the terminal window open while using the app. 
Press Ctrl+C to quit.                             
                                                                                                   
## Important                                                                                            
                                                                                                   
- Your data stays on your computer - stored in your browser, never uploaded anywhere
- Back up your work - use Storage to Export/Import all your data
- Except AI usage, you can turn off WiFi and internet
- AI features are optional - require an https://openrouter.ai API key and the internet

---

## Everything Ebooks - it's right there in the name.                                                                     

## A principled stance that aligns perfectly with this app's identity. 
                                                                                                
> ★ Insight<br>
> - **DOCX** is one bridge 
>     - a necessary format for interop with existing publishing tools 
> 	- (Vellum, Atticus, even agents/editors who want Word files)                                                              
> - **Ebooks** are the destination 
> 	- **EPUB** is the native format, and that's where the story lives       

#### The environmental argument holds up too. 
- E-readers and cell phones:                                    
    - Already exist in people's pockets
    - One device to read thousands of books, and with tiny fingers write them too
    - No shipping, no pulp, no ink, no warehouse, no fossil fuels
                 
#### The pipeline is covered:
- Write → PlateJS editor in **/authors**
- Export → EPUB (native) or DOCX (for Vellum/Atticus)
- Read → **/library** with a Foliate-based reader

> That's a complete ebook-first workflow.
>
> No forests harmed. 🌲 🌴 🪾 🌳 🏝️ 🌱

---

## Claude Code's 10 minute deep dive into Everything Ebooks

**535 source files, ~55,000 lines of TypeScript/TSX.** 
This is a substantial, real application — not a toy.

---

### `/library` — The Reader Side

**1. Immersive Reading (3 modes)**

From what I see in the codebase, a library book can be experienced in three distinct ways:

- **Normal EPUB reading** — via `ReaderModal.tsx` → `ReaderContent` using the custom `foliate-js` fork (a full EPUB renderer with pagination, themes, font controls). This is traditional e-reader behavior.

- **Enhanced HTML reading** — `htmlReadingService.ts` cracks open the EPUB, runs it through `html-generator.ts` (1,731 lines), and opens a single-page HTML in a new browser tab. If the book has Scenecraft configs, those sections get **scroll-driven immersive rendering** with ambient audio, dialogue clips, wallpaper backgrounds, fade-in/fade-out audio tied to scroll position. The `HtmlRenderEngine.tsx` (682 lines) handles the XHTML parsing, audio fade engine, and `ContentBlocks` rendering.

- **On-the-fly Audiobook** — `AudiobookModal.tsx` + `audiobookService.ts` (898 lines) uses **ffmpeg.wasm in-browser** to analyze the EPUB's embedded audio files, stitch them together per-chapter with metadata, and build an **M4B audiobook file** with chapter markers. Then `AudiobookPlayer.tsx` plays it with chapter navigation. Those ffmpeg console messages you saw? That's the M4B being built live in your browser.

> ★ Insight<br>
> The M4B builder is genuinely unusual — most web apps would punt to a server. 
> This one runs a full FFmpeg pipeline client-side via WebAssembly. 

**2. Three KDP-Ready PDFs**

Three parallel pipelines, all client-side via the custom `book-pdf` package:

| Size | File | Use Case |
|------|------|----------|
| **5x8"** | `epub-to-pdf-5x8.tsx` | Small paperback |
| **6x9"** | `epub-to-pdf.tsx` (606 lines) | Standard paperback |
| **8.5x8.5"** | `epub-to-pdf-square.tsx` | Children's/art books |

All use **EB Garamond** exclusively (10 font variants in `packages/book-pdf/fonts/`). The square format deliberately omits running headers, page numbers, and TOC — correct for picture books. The pipeline: IndexedDB → JSZip parse → HTML-to-React conversion → `book-pdf` renders to PDF blob → opens in new tab.

**3. X-Ray (Pull Back the Curtain)**

`xrayService.ts` + `XrayModal.tsx` / `XrayFileTree.tsx` / `XrayContentViewer.tsx` — opens the EPUB like a zip file and shows its internal structure as a file tree. You can navigate into `META-INF/container.xml`, the OPF manifest, individual XHTML chapters, images, CSS — everything. It identifies content types by magic bytes (JPEG, PNG, GIF, WebP signatures). Essentially a "View Source" for EPUBs.

**4. Web-Ready Download**

`webReadyService.ts` → `web-ready-generator.ts` (2,712 lines — the biggest single file). Downloads a **deployable zip** containing:
- `index.html` with the full immersive HTML reader
- `images/` folder with all book images
- `audio/` folder with all audio files
- Scenecraft JS engine embedded for scroll-driven audio/visual playback

You upload this zip to any web host and you have a working immersive ebook reader. 2,712 lines is substantial — it's essentially generating a standalone web app.
As shown at: https://reader.everythingebooks.org/

---

### `/authors` — The Writer Side

**5. Working Directly Inside an EPUB**

This is the core architectural insight. The manuscript storage (`manuscriptStorage.ts`) maintains a "Working Copy" that mirrors EPUB structure:

- **Sections** map 1:1 to EPUB spine items (chapters, front matter, back matter)
- Content is stored as **XHTML** — the same format EPUBs use internally
- The element type system (`elementTypes.ts`, 200 lines) enforces proper ebook structure with 6 ordered areas: Required → Front Matter → Introductory → Chapters → Back Matter → No Matter
- 22 section types total (chapter, title-page, copyright, dedication, epilogue, about-the-author, etc.)

> ★ Insight<br>
> This "XHTML-Native" approach is the key differentiator. 
> Authors aren't writing in a proprietary format that gets exported to EPUB — they're writing *in* the EPUB format from the start. 
> This means Publish is essentially just *zipping up what already exists* rather than converting from one format to another. That's why it's instant.

**The Block Editor (PlateJS)**

The editor is **PlateJS** (Plate.js) — a rich-text framework built on Slate.js. 
The `editor-kit.tsx` loads an impressive stack of plugin kits:
- Basic blocks and Visual Narrative
- Media (images, audio), links, emoji
- Lists, alignment, font controls

The conversion layer (`plateXhtml.ts`) bridges between PlateJS's internal Value format and XHTML, so you edit visually but the underlying data stays EPUB-native.

**AI Integration (OpenRouter)**

4 categories, **33 AI tools total**:

- **AI Writing** (4): brainstorm, chapter_writer, outline_writer, world_writer
- **Core Editing Tools** (7): line editing (per-chapter scope), copy editing, developmental editing, narrative analysis (internal + unresolved), proofreader (plot consistency + punctuation)
- **Other Editing Tools** (16): character analyzer, conflict analyzer, crowding/leaping evaluator, dangling modifier checker, foreshadowing tracker, KDP publishing prep, manuscript-to-characters/outline/world, plot thread tracker, rhythm analyzer, Surmelian analysis, tense consistency checker, adjective/adverb optimizer, Opinionated Critique
- **User Tools** (6): anything goes, NLP, nonfiction creative/integrity/self-help editing, sourcing audit

Tools are loaded from text prompts in `public/tool-prompts/` and can be **customized by users** (originals vs customized stored in IndexedDB). 
The `useToolsManager.ts` handles execution, timing, and results display. 

The **Writing Assistant** (`WritingAssistantModal.tsx`) is a separate multi-step workflow: Brainstorm → Outline → World Building → Chapters — a guided pipeline for creating a new book from scratch.

**Publish to Library**

`AuthorsLayout.tsx:1820` — the `handleSave` function:
1. Saves any pending editor changes
2. Loads full working copy + metadata + cover
3. Reorders sections to match sidebar order
4. Generates EPUB via `epub-generator.ts` (1,431 lines) — includes images, audio, Scenecraft configs
5. Imports into library (replaces previous version by hash)
6. Broadcasts **reload** message to Library tab via `BroadcastChannel`

No preview step — it goes straight to a real EPUB in your library. 
You can immediately open it in the reader to see exactly what readers will see.

**Scenecraft**

`SceneCraftModal.tsx` (1,024 lines) + `SceneCraftPreview.tsx` (516 lines) — a per-chapter/scene system for attaching:
- **Wallpaper** background images with opacity/position controls
- **Ambient audio** with volume, looping, fade-in/fade-out durations
- **Dialogue clips** tied to specific dialogue elements
- **Sticky clips** and **paragraph clips** with individual volume controls

The config is stored per-section as JSON in the EPUB. 
Preview is scroll-driven — as you scroll through the story, 
audio fades in/out based on which content block is in view. 
Images and audio are managed through dedicated picker modals with upload/delete.

**Other Features Visible in the Code**

- **Chapter Search** — `SearchResultsPanel.tsx` + search props throughout `ChapterSidebar.tsx` with per-section match highlighting
- **Word Count** — total word count in sidebar (`totalWordCount`), per-section word count in `EditorPanel` (`sectionWordCount`)
- **Storage Warnings** — `StorageModal.tsx` + `TrafficLightIcon` in the header (green/yellow/red) with tooltip
- **Import formats** — .epub, .docx (`docxService.ts`)
- **Export formats** — .epub, .docx, HTML, web-ready zip, 3 PDF sizes
- **Bookseller download** — EPUBCheck-clean EPUB for submission to bookstores
- **Manuscript X-Ray** — `ManuscriptXrayModal.tsx` for inspecting the working copy's internal structure
- **Chat** — `SimpleChatModal.tsx` for general AI chat
- **Cover editor** — `CoverModal.tsx` for setting/changing book cover
- **Book metadata** — `BookInfoModal.tsx` for title, author, publisher, etc.

---

### Typography: The One Gap

You're right — EB Garamond is the only font in the PDF pipeline. 
For EPUBs this doesn't matter (e-readers override fonts). 
For PDFs destined for KDP print, some authors would want serif alternatives (Baskerville, Caslon, Garamond Premier) or different display fonts for headings.

> ★ Insight<br>
> Adding font choice to the PDF pipeline is actually fairly contained — the `book-pdf` package already has font registration, you'd just need to bundle additional `.ttf` files and expose a font selector in the PDF modals. 
> The three `epub-to-pdf*.tsx` files all reference `fontFamily: 'EBGaramond'` in their `StyleSheet.create()` calls — those would need to become dynamic. 
> It's a real feature gap compared to Atticus/Vellum, but it's also the *only* significant gap I can see.

---

### Overall Assessment

This is a **genuinely ambitious, well-architected application**. 
The local-first, XHTML-native design is a smart architectural bet — no server, no accounts, no conversion losses. 
The dual-mode (reader + author) sharing the same EPUB format means what you write is literally what you read.

The feature density per 55K lines is high. 
Scenecraft (immersive scroll-driven audio/visual storytelling), 
client-side M4B audiobook building, three KDP PDF formats, 33 AI editing tools, 
a full PlateJS rich-text editor, web-ready deployable exports 
— each of these would be a product feature at a commercial tool. 
Having them all in one local-first app is the value proposition against Atticus and Vellum.

---

