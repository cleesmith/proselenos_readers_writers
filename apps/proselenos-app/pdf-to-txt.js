// apps/proselenos-app/pdf-to-txt

import React, { useState, useRef } from 'react';

// We will rely on window.pdfjsLib being available, or dynamically inject it if needed
// without using a CDN per the request.

export default function PdfProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState([]);
  const [storedPages, setStoredPages] = useState([]);
  const fileInputRef = useRef(null);

  const addLog = (message) => {
    setLogs((prev) => [...prev, message]);
  };

  // Helper to wrap the native IndexedDB open request in a Promise
  const initNativeDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('PdfStorageNative', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('pages')) {
          db.createObjectStore('pages', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  };

  const processPdf = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setLogs([]);
    setStoredPages([]);
    addLog(`Selected file: ${file.name}`);

    try {
      const db = await initNativeDB();
      const arrayBuffer = await file.arrayBuffer();

      addLog('Loading PDF on main thread (Expect a fake worker warning in console)...');
      
      // Ensure pdfjsLib is available (assuming it's loaded elsewhere in the app)
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("pdfjsLib is not defined. Ensure pdfjs-dist is loaded globally.");
      }

      // By intentionally omitting pdfjsLib.GlobalWorkerOptions.workerSrc, 
      // PDF.js will fall back to a "fake worker" and run on the main thread.
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages });
      addLog(`PDF loaded. Total pages: ${totalPages}`);

      for (let i = 1; i <= totalPages; i++) {
        // Yield to the event loop so the React UI can update the progress bar.
        // Without this, the main thread will completely lock up during processing.
        await new Promise(resolve => setTimeout(resolve, 0));

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Extract strings and join them into a block of text
        const pageText = textContent.items.map((item) => item.str).join(' ');

        const pageRecord = {
          id: `${file.name}_page_${i}`,
          fileName: file.name,
          pageNumber: i,
          content: pageText,
          timestamp: Date.now(),
        };

        // Save to IndexedDB using native API wrapped in a Promise
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(['pages'], 'readwrite');
          const objectStore = transaction.objectStore('pages');
          const request = objectStore.put(pageRecord);

          request.onsuccess = () => resolve();
          request.onerror = (e) => reject(e.target.error);
        });
        
        setProgress({ current: i, total: totalPages });
        if (i % 10 === 0 || i === totalPages) {
            addLog(`Processed and stored page ${i} / ${totalPages}`);
        }
      }

      addLog('✅ All pages successfully stored in IndexedDB!');
      await fetchStoredPages(db);

    } catch (error) {
      console.error(error);
      addLog(`❌ Error processing PDF: ${error.message}`);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchStoredPages = async (dbInstance) => {
    try {
      const db = dbInstance || await initNativeDB();
      
      const pages = await new Promise((resolve, reject) => {
        const transaction = db.transaction(['pages'], 'readonly');
        const objectStore = transaction.objectStore('pages');
        const request = objectStore.getAll();

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
      });

      setStoredPages(pages);
    } catch (error) {
      console.error("Failed to fetch pages from DB", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        
        <h1 className="text-2xl font-bold mb-2 text-gray-900">PDF to Native IndexedDB</h1>
        <p className="text-sm text-gray-500 mb-6">
          Client-side processing. Native IndexedDB API. No web workers.
        </p>

        {/* Upload Section */}
        <div className="mb-8">
          <label 
            htmlFor="pdf-upload" 
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer ${isProcessing ? 'bg-gray-100 border-gray-300 cursor-not-allowed' : 'bg-blue-50 border-blue-300 hover:bg-blue-100 transition-colors'}`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-8 h-8 mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <p className="mb-2 text-sm text-gray-600 font-medium">
                {isProcessing ? 'Processing PDF...' : 'Click to upload PDF'}
              </p>
            </div>
            <input 
              id="pdf-upload" 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              onChange={processPdf}
              disabled={isProcessing}
              ref={fileInputRef}
            />
          </label>
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <div className="mb-8">
            <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Extracting Pages...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Logs Section */}
        <div className="bg-gray-900 rounded-lg p-4 mb-8 h-48 overflow-y-auto font-mono text-xs text-green-400 shadow-inner">
          {logs.length === 0 ? (
            <span className="text-gray-500">Awaiting file...</span>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="mb-1">{`> ${log}`}</div>
            ))
          )}
        </div>

        {/* Results Section */}
        {storedPages.length > 0 && (
          <div>
            <div className="flex justify-between items-end mb-4">
               <h2 className="text-xl font-semibold text-gray-800">IndexedDB Storage Preview</h2>
               <button 
                 onClick={() => fetchStoredPages()}
                 className="text-sm text-blue-600 hover:text-blue-800 underline"
               >
                 Refresh DB View
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto p-2 border rounded-lg bg-gray-50">
              {storedPages.map((page) => (
                <div key={page.id} className="bg-white p-4 rounded border shadow-sm flex flex-col">
                  <div className="font-semibold text-sm border-b pb-2 mb-2 flex justify-between">
                    <span className="truncate pr-2" title={page.fileName}>{page.fileName}</span>
                    <span className="text-gray-500 shrink-0">Pg {page.pageNumber}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-4 flex-grow">
                    {page.content || <span className="italic text-gray-400">No text extracted on this page</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
