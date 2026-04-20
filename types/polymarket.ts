export type PolymarketBookLevel = {
  price: string;
  size: string;
};

export type PolymarketBook = {
  asset_id?: string;
  bids?: PolymarketBookLevel[];
  asks?: PolymarketBookLevel[];
};

export type PolymarketDiscoverResponse = {
  ok: boolean;
  source: string;
  slug: string;
  startTs: number;
  endTs: number;
  startUtc: string;
  endUtc: string;
  startEt: string;
  endEt: string;
  currentStartTs: number;
  candidates: string[];
};

export type PolymarketMarketRaw = {
  question?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  outcomes?: string | string[];
  outcomePrices?: string | number[];
  clobTokenIds?: string | string[];
};

export type SidePrice = {
  tokenId: string;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  topBidSize: number | null;
  topAskSize: number | null;
  topDepth: number | null;
};

export type PolymarketSnapshotResponse = {
  ok: boolean;
  market: {
    eventTitle: string;
    slug: string;
    startDate: string;
    endDate: string;
    source: string;
    priceToBeat: number | null;
  };
  prices: {
    up: SidePrice;
    down: SidePrice;
  };
  recentTrade: {
    price: number | null;
    side: "buy" | "sell" | null;
  };
  candidates: string[];
  fetchedAt: string;
};
