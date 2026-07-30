import type { APIRoute, GetStaticPaths } from "astro";

import topPapers from "../../../public/data/top_papers.json";
import { markdownResponse } from "@/lib/markdown-response";

type Paper = (typeof topPapers)[number];

export const getStaticPaths = (() =>
  topPapers.map((paper) => ({
    params: { arxiv_id: paper.arxiv_id },
    props: { paper },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const paper = props.paper as Paper;
  const arxivUrl = `https://arxiv.org/abs/${paper.arxiv_id}`;
  const pdfUrl = `https://arxiv.org/pdf/${paper.arxiv_id}`;

  return markdownResponse(`# ${paper.title}

- arXiv ID: ${paper.arxiv_id}
- Published: ${paper.submitted_date}
- Primary category: ${paper.primary_category}
- Citations: ${paper.citation_count.toLocaleString("en-US")}
- Citations per year: ${Math.round(paper.cites_per_year).toLocaleString("en-US")}
- In-corpus degree: ${paper.in_corpus_degree.toLocaleString("en-US")}
- PageRank: ${paper.pagerank_score.toFixed(6)}
- Katz centrality: ${paper.katz_score.toFixed(6)}

## Topics

${paper.topic_tags.length ? paper.topic_tags.map((tag) => `- ${tag}`).join("\n") : "- No topic tags are available."}

## Keywords

${paper.top_keywords.length ? paper.top_keywords.map((keyword) => `- ${keyword}`).join("\n") : "- No extracted keywords are available."}

## Sources

- [Abstract and metadata on arXiv](${arxivUrl})
- [PDF on arXiv](${pdfUrl})
- [Corpus data methodology](https://papers.highsignal.app/data)

Citation count and graph metrics come from the researchPapers static corpus
export. The linked arXiv record remains the authority for the paper itself.
`);
};
