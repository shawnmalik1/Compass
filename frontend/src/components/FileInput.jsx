import { useRef, useState } from 'react';

function FileInput({ onSelect }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (fileList) => {
    const file = fileList?.[0];
    if (file) {
      onSelect(file);
    }
  };

  const handleInputChange = (event) => {
    handleFile(event.target.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    handleFile(event.dataTransfer.files);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleInputChange}
        className="hidden"
      />
      <div
        role="button"
        tabIndex={0}
        className={`flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed text-sm transition ${
          dragActive
            ? 'border-compass-primary/70 bg-compass-primary/10 text-slate-100'
            : 'border-slate-700 text-slate-300 hover:border-compass-primary/60 hover:bg-slate-900'
        }`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            inputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p className="text-base font-semibold text-slate-100">
          Drop a file anywhere in this panel
        </p>
        <p className="mt-1 text-xs text-slate-400">
          or click to browse. Supports PDF or plain text.
        </p>
      </div>
      <p className="text-sm text-slate-400">
        Files are processed locally, then analyzed by the backend.
      </p>
    </div>
  );
}

export default FileInput;
