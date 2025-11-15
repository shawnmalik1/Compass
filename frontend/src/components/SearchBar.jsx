import React, { useState } from "react";

function SearchBar({ onSearch, onClear }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(value);
  }

  function handleClear() {
    setValue("");
    if (onClear) onClear();
  }

  const hasText = value.trim().length > 0;

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search topics or headlines (e.g. elections, climate)..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {hasText && (
        <button type="button" className="secondary" onClick={handleClear}>
          Clear
        </button>
      )}
      <button type="submit">Search</button>
    </form>
  );
}

export default SearchBar;
