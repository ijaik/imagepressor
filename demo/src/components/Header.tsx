import { Check, Copy, Package, ChevronsLeftRightEllipsis } from "lucide-react";
import { copyText, useCopiedFlag } from "../lib/clipboard";
import { Button } from "./Primitives";
const GITHUB_URL = "https://github.com/ijaik/imagepressor";
const NPM_URL = "https://www.npmjs.com/package/imagepressor";
export default function Header() {
  const [copied, flashCopied] = useCopiedFlag();
  const copyInstall = async () => {
    if (await copyText("npm i imagepressor")) flashCopied();
  };
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink">
      <div className="mx-auto flex h-14 w-full max-w-310 items-center justify-between gap-4 px-5 sm:px-8">
        <span className="font-display text-[20px] leading-none tracking-tight text-paper">
          imagepressor
        </span>
        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <Button
              variant="quiet"
              onClick={copyInstall}
              title="Copy the install command"
              className="h-9 border border-line px-2.5 text-muted hover:border-line-2 hover:text-paper"
            >
              <span aria-hidden="true" className="text-signal">
                $
              </span>
              <span className="normal-case tracking-normal">
                npm i imagepressor
              </span>
              {copied ? (
                <Check className="size-3 text-good" aria-hidden="true" />
              ) : (
                <Copy className="size-3" aria-hidden="true" />
              )}
            </Button>
          </div>
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:border-line-2 hover:text-paper"
          >
            <Package className="size-3" aria-hidden="true" />
            npm
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition-colors duration-150 hover:border-line-2 hover:text-paper"
          >
            <ChevronsLeftRightEllipsis className="size-3" aria-hidden="true" />
            source
          </a>
        </div>
      </div>
    </header>
  );
}
