import { StudioFooter } from "@saas-maker/ui/blocks/footer";

interface Props {
  summary: string;
  legal: string;
  artAlt: string;
}

export default function StudioFooterIsland({ summary, legal, artAlt }: Props) {
  return (
    <StudioFooter
      product="Research Papers"
      url="https://papers.highsignal.app"
      catalogId="research-papers"
      capture="newsletter"
      variant="studio"
      artMode="panel"
      wordmark="poster"
      art={{
        src: "/footer-art/research-papers.webp",
        alt: artAlt,
        position: "50% 50%",
      }}
      summary={summary}
      legal={legal}
      groups={[
        {
          title: "Research Papers",
          links: [
            { label: "Search the public index", href: "#search" },
            { label: "Corpus and provenance", href: "/data" },
            { label: "Curated reading paths", href: "/paths" },
            { label: "Changelog", href: "/changelog" },
            {
              label: "GitHub",
              href: "https://github.com/High-Signal-App/research-papers",
            },
          ],
        },
      ]}
    />
  );
}
