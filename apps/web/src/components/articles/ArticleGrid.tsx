import React from "react";
import type { ArticleCardVM } from "../../lib/articles/adapter.js";
import { ArticleCard } from "./ArticleCard.js";

/** Desktop 3, planshet 2, telefon 1 ustun. */
export function ArticleGrid({ articles, className = "" }: { articles: ArticleCardVM[]; className?: string }) {
  if (articles.length === 0) return null;
  return (
    <ul className={`grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {articles.map((article) => (
        <li key={article.id} className="min-w-0">
          <ArticleCard article={article} />
        </li>
      ))}
    </ul>
  );
}
