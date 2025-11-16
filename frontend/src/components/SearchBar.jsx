import React, { useState } from 'react';

function SearchBar({ onSearch, onClear }) {
  const [value, setValue] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleClear = () => {
    setValue('');
    if (onClear) {
      onClear();
    }
  };

  const hasText = value.trim().length > 0;

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Search topics or headlines (e.g. elections, climate)..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {hasText && (
        <button type="button" className="secondary" onClick={handleClear}>
          Clear
        </button>
      )}
      <button type="submit" disabled={!hasText}>
        Search
      </button>
    </form>
  );
}

export default SearchBar;