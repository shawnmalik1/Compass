import { useRef } from 'react';

function FileInput({ onSelect }) {
  const inputRef = useRef(null);

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelect(file);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-lg bg-compass-primary px-4 py-2 text-sm font-semibold text-slate-900 shadow"
      >
        Select file
      </button>
      <p className="text-sm text-slate-400">
        Currently supports PDF or plain text. Files are processed locally then
        analyzed by the backend.
      </p>
    </div>
  );
}

export default FileInput;
