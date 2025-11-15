import React from "react";

function Landing({ onEnter, mapReady }) {
  const highlights = [
    {
      title: "Explore topics visually",
      text: "Glide across 40+ major themes and hundreds of subtopics generated from NYT archives.",
    },
    {
      title: "Research faster",
      text: "Search semantically or drop in your own writing to see related coverage instantly.",
    },
    {
      title: "Focus on what matters",
      text: "Dive into a cluster and watch the rest fade out so you can study the relationships inside.",
    },
  ];

  return (
    <div className="landing-page">
      <div className="landing-glow" />
      <div className="landing-content">
        <header className="landing-hero">
          <p className="eyebrow">Compass · Granular Knowledge Map</p>
          <h1>
            A research workspace for students built on the news.
          </h1>
          <p className="subtitle">
            Thousands of New York Times articles, embedded with transformers and clustered into an interactive atlas so students can sprint through background research, cite smarter, and discover unexpected angles.
          </p>
          <div className="hero-stats">
            <div>
              <h3>8K+</h3>
              <p>articles embedded</p>
            </div>
            <div>
              <h3>240</h3>
              <p>coarse + fine clusters</p>
            </div>
            <div>
              <h3>Semantic search</h3>
              <p>plus document uploads</p>
            </div>
          </div>
        </header>

        <section className="landing-highlights">
          {highlights.map((item) => (
            <article key={item.title}>
              <h4>{item.title}</h4>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <button
          type="button"
          className="cta-button"
          onClick={onEnter}
          disabled={!mapReady}
        >
          {mapReady ? "Explore Knowledge Graph" : "Preparing map…"}
        </button>
      </div>
    </div>
  );
}

export default Landing;
