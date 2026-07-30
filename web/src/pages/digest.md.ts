import type { APIRoute } from "astro";

import hot from "../../public/data/hot.json";
import reviewVenues from "../../public/data/review_venues.json";
import sleepers from "../../public/data/sleepers.json";
import tagRating from "../../public/data/tag_rating.json";
import { markdownResponse } from "@/lib/markdown-response";

export const prerender = true;

const totalReviews = reviewVenues.reduce(
  (sum: number, venue: { n_reviews?: number }) => sum + Number(venue.n_reviews || 0),
  0,
);

function paperUrl(paperId: string) {
  if (paperId.startsWith("arxiv:")) {
    return `https://arxiv.org/abs/${paperId.replace("arxiv:", "")}`;
  }
  return `https://openreview.net/forum?id=${paperId.replace("openreview:", "")}`;
}

export const GET: APIRoute = () =>
  markdownResponse(`# HighSignal research digest

A compact view of what the research corpus and ${totalReviews.toLocaleString("en-US")}
aggregated peer reviews currently signal.

## Reviewer-loved early work

${sleepers
  .slice(0, 8)
  .map(
    (paper) =>
      `- [${paper.title}](${paperUrl(paper.paper_id)}) — rating ${paper.avg_rating.toFixed(2)} at ${paper.venue}`,
  )
  .join("\n")}

## Hot right now

${hot
  .slice(0, 10)
  .map(
    (paper, index) =>
      `${index + 1}. [${paper.title}](${paperUrl(paper.paper_id)}) — hotness ${paper.hotness.toFixed(2)}, ${Math.round(paper.cites_per_year).toLocaleString("en-US")} citations/year`,
  )
  .join("\n")}

## Topics reviewers are excited about

${tagRating
  .slice(0, 12)
  .map(
    (topic) =>
      `- ${topic.tag}: mean rating ${topic.mean_rating.toFixed(2)} across ${topic.n_papers} papers`,
  )
  .join("\n")}
`);
