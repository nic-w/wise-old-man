"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Player } from "@wise-old-man/utils";
import { Fragment, forwardRef, useEffect, useRef, useState } from "react";
import { Combobox as HeadlessCombobox, Transition } from "@headlessui/react";
import { cn } from "~/utils/styling";
import { isAppleDevice } from "~/utils/platform";
import useSearchPlayers from "~/hooks/useSearchPlayers";
import useDebouncedValue from "~/hooks/useDebouncedValue";
import useRecentSearches from "~/hooks/useRecentSearches";
import { PlayerIdentity } from "./PlayerIdentity";

import CloseIcon from "~/assets/close.svg";
import SearchIcon from "~/assets/search.svg";
import LoadingIcon from "~/assets/loading.svg";

// Can't be server rendered - requires the browser's navigator to be defined (to determine if it's macOS or not)
const SearchHotkeys = dynamic(() => import("../components/SearchHotkeys"), {
  ssr: false,
});

export function Search() {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearchQuery = useDebouncedValue(query, 250);

  const { recentSearches, addSearchTerm } = useRecentSearches({
    enabled: open,
  });

  const { data: players } = useSearchPlayers(debouncedSearchQuery, {
    enabled: open && debouncedSearchQuery.length > 0,
  });

  const hasExactMatch = players?.some((player) => isExactMatch(query, player.username));
  const showResults = query.length > 0 || (recentSearches && recentSearches.length > 0);

  // Toggle the menu when ⌘+K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const metaKeyPressed = isAppleDevice() ? e.metaKey : e.ctrlKey;

      if (e.key === "k" && metaKeyPressed) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  function handlePlayerSelected(username: string) {
    addSearchTerm(username);

    if (!query) {
      setQuery(username);
    }

    setTimeout(() => {
      inputRef.current?.blur();
    }, 10);

    router.push(`/players/${username}`);
  }

  return (
    <HeadlessCombobox value={query} onChange={handlePlayerSelected}>
      {({ activeOption }) => (
        <div className="relative w-80" onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
          <SearchInput ref={inputRef} onChange={(e) => setQuery(e.target.value)} />
          <Transition
            show={open && showResults}
            as={Fragment}
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            leave="transition ease-in duration-100"
          >
            <HeadlessCombobox.Options
              static={open}
              className="custom-scroll absolute right-0 mt-1 max-h-60 w-full translate-y-1 overflow-auto rounded-md border border-gray-500 bg-gray-700 p-1 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
            >
              {query.length > 0 && !players ? (
                <LoadingState />
              ) : (
                <>
                  {query.length === 0 ? (
                    <RecentSearches />
                  ) : (
                    <>
                      {players && players.length === 0 && query.length > 0 ? (
                        <SearchSuggestionItem term={debouncedSearchQuery} />
                      ) : (
                        <>
                          <div className="select-none p-2 text-xs text-gray-100">
                            Search results for &quot;{debouncedSearchQuery}&quot;
                          </div>
                          {!hasExactMatch && <SearchSuggestionItem term={debouncedSearchQuery} />}
                          {players
                            ?.sort((a) => (isExactMatch(query, a.username) ? -1 : 0))
                            .map((player) => (
                              <SearchResultItem key={player.username} player={player} />
                            ))}
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </HeadlessCombobox.Options>
          </Transition>
          <Prefetcher activeOption={activeOption} />
        </div>
      )}
    </HeadlessCombobox>
  );
}

function LoadingState() {
  return (
    <div className="relative flex cursor-default select-none items-center gap-x-3 px-4 py-2 text-gray-200">
      <LoadingIcon className="h-6 w-6 animate-spin" />
      Loading...
    </div>
  );
}

function RecentSearches() {
  const { recentSearches, removeSearchTerm, clearSearchTerms } = useRecentSearches({
    enabled: true,
  });

  if (!recentSearches || recentSearches.length === 0) return null;

  return (
    <div className="relative cursor-default">
      <div className="flex items-center justify-between p-2">
        <span className="select-none text-xs text-gray-100">Recent searches</span>
        <button className="text-xs text-blue-400 hover:underline" onClick={() => clearSearchTerms()}>
          Clear
        </button>
      </div>
      {recentSearches.map((term) => (
        <RecentSearchItem key={term} term={term} onRemove={() => removeSearchTerm(term)} />
      ))}
    </div>
  );
}

interface SearchSuggestionItemProps {
  term: string;
}

function SearchSuggestionItem(props: SearchSuggestionItemProps) {
  const { term } = props;

  return (
    <HeadlessCombobox.Option
      value={term}
      className={({ active }) =>
        cn(
          "relative block cursor-default select-none truncate rounded p-2",
          active ? "bg-gray-600 text-white" : "text-gray-100"
        )
      }
    >
      <div className="flex items-center text-sm text-white">
        <div className="relative mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-400">
          <SearchIcon className="h-4 w-4 text-gray-200" />
        </div>
        <span className="line-clamp-1 text-sm text-gray-100">
          Go to <span className="font-medium text-white">{term}</span>
        </span>
      </div>
    </HeadlessCombobox.Option>
  );
}

interface RecentSearchItemProps {
  term: string;
  onRemove: () => void;
}

function RecentSearchItem(props: RecentSearchItemProps) {
  const { term, onRemove } = props;

  return (
    <HeadlessCombobox.Option
      value={term}
      className={({ active }) =>
        cn(
          "relative flex cursor-default select-none items-center justify-between truncate rounded p-2",
          active ? "bg-gray-600 text-white" : "text-gray-100"
        )
      }
    >
      <div className="flex items-center text-sm text-white">
        <div className="relative mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-400">
          <SearchIcon className="h-4 w-4 text-gray-200" />
        </div>
        <span className="line-clamp-1 text-sm font-medium">{term}</span>
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            onRemove();
            e.stopPropagation();
          }}
        >
          <CloseIcon className="h-6 w-6 rounded p-1 hover:bg-gray-400" />
        </button>
      )}
    </HeadlessCombobox.Option>
  );
}

function SearchResultItem(props: { player: Player }) {
  const { player } = props;

  return (
    <HeadlessCombobox.Option
      value={player.displayName}
      className={({ active }) =>
        cn(
          "relative block cursor-default select-none truncate rounded p-2",
          active ? "bg-gray-600 text-white" : "text-gray-100"
        )
      }
    >
      <div className="pointer-events-none">
        <PlayerIdentity player={player} renderTooltip={false} />
      </div>
    </HeadlessCombobox.Option>
  );
}

interface SearchInputProps {
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>((props, ref) => {
  const { onChange, ...inputProps } = props;
  return (
    <div className="relative">
      <HeadlessCombobox.Input
        ref={ref}
        autoComplete="off"
        placeholder="Search players..."
        onChange={(event) => onChange(event)}
        className={cn(
          "flex h-10 w-full items-center rounded-md border border-gray-600 bg-gray-950 px-10 text-sm leading-7 shadow-inner shadow-black/50 placeholder:text-gray-400",
          "focus-visible:bg-black focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-500 focus-visible:ring-offset-0"
        )}
        {...inputProps}
      />
      <div className="pointer-events-none absolute bottom-0 left-3 top-0 flex items-center">
        <SearchIcon className="h-5 w-5 text-gray-300" />
      </div>
      <SearchHotkeys />
    </div>
  );
});
SearchInput.displayName = "SearchInput";

/**
 * HeadlessUI doesn't expose an "onActiveOptionChanged" event, only an "activeOption" render prop.
 * so instead we have to pass that renderProp down to a component that then listens for changes on it.
 * We then use that active option to prefetch the page that it leads to.
 */
function Prefetcher(props: { activeOption: string | null }) {
  const { activeOption } = props;

  const router = useRouter();

  useEffect(() => {
    if (!activeOption) return;
    router.prefetch(`/players/${activeOption}`);
  }, [router, activeOption]);

  return null;
}

function isExactMatch(query: string, username: string) {
  return username.trim().toLowerCase() === query.trim().toLowerCase();
}
