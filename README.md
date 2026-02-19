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

## The Power of Three: EBook, EeBook, EhBook

Drop an ebook into **Everything Ebooks** and you instantly have three ways to read and share it.

**EBook** - is the standard epub format that works on any ebook reader you already use. Nothing changes, nothing breaks. It is the book you started with.

**EeBook** - is the same book opened in the Everything Ebooks reader. 
It looks better, reads better, and gives you features that ordinary readers do not offer.

**EhBook** - is something new. One click and you download your book as a single HTML+CSS+Javascript file that opens in any web browser. No app to install. No account to create. No store to browse. Just open it. Send it to a friend, put it on a thumb drive, email it to yourself. It works on a phone, a laptop, a tablet, anything with a browser. Light mode, dark mode, all built in.

Three formats from one ebook. You do not have to be an author or go through a publishing process. You do not need technical knowledge. Your book never leaves your device and no server ever sees it. Everything happens right where you are, in your browser, on your machine.

Write once, read everywhere is a promise others have made. 
Everything Ebooks actually delivers it, and you do not have to write a word. 
Just bring an ebook you already have.
But if you're an author, read on.

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
2. Start writing and add chapters, front matter, back matter
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

# Running Everything Ebooks on Your Computer                                                           
                                                                                                       
## What You'll Need                                                                                     
                                                                                                   
1. Node.js - Download and install from https://nodejs.org                                            
2. pnpm - After installing Node.js, 
	open Terminal (Mac) or Command Prompt (Windows) and type:        
	npm install -g pnpm                                                                                  
                                                                                                   
## Setup (One Time)                                                                                     
                                                                                                   
1. Download this project as a ZIP file from GitHub and unzip it                                      
2. Open Terminal/Command Prompt and navigate to that folder:                                         
cd path/to/everything-ebooks                                                                         
3. Run these commands (one at a time):                                                               
	pnpm install                                                                                         
	pnpm build (this runs for a few minutes but makes the app much faster)                                                                                 
                                                                                                   
## Launch the App                                                                                       
                                                                                                   
pnpm start                                                                                           
                                                                                                   
Then open your browser to http://localhost:3000                                                      
                                                                                                   
Keep the terminal window open while using the app. 
Press Ctrl+C to quit.                             
                                                                                                   
## Important                                                                                            
                                                                                                   
- Your data stays on your computer - stored in your browser, never uploaded anywhere                 
- Back up your work - use Storage to Export/Import all your data                                     
- AI features are optional - require an https://openrouter.ai API key                                

---

## Everything Ebooks - it's right there in the name.                                                                     

## A principled stance that aligns perfectly with this app's identity. 
                                                                                                
### ★ Insight                  
- **DOCX** is one bridge 
    - a necessary format for interop with existing publishing tools 
	- (Vellum, Atticus, even agents/editors who want Word files)                                                              
- **PDF** is for print 
    - and this app is not in the business of encouraging print                          
- **Ebooks** are the destination 
	- **EPUB** is the native format, and that's where the story lives       

#### The environmental argument holds up too. 
- E-readers and phones:                                    
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
