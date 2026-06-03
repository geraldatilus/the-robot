"""Market universe and ETF lists."""

SP500 = [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","LLY","JPM","V","UNH",
    "XOM","MA","AVGO","JNJ","PG","HD","COST","ABBV","MRK","CVX","CRM",
    "BAC","WMT","KO","PEP","TMO","ORCL","CSCO","ACN","ADBE","MCD","NKE",
    "NFLX","DIS","PM","TXN","NEE","QCOM","INTC","AMGN","INTU","IBM","CAT",
    "GS","SBUX","BKNG","ISRG","ELV","PFE","BMY","RTX","HON","MMM","SCHW",
    "BLK","AXP","C","WFC","MS","USB","TGT","LOW","DE","BA","GE","LMT",
    "MDT","GILD","REGN","VRTX","ZTS","SYK","BSX","ABT","DHR","TSLA","AMD",
]

NASDAQ100 = [
    "AAPL","MSFT","NVDA","AMZN","META","GOOGL","TSLA","AVGO","COST","NFLX",
    "ASML","AMD","QCOM","TMUS","INTU","CSCO","AMAT","TXN","ADBE","MU",
    "HON","SBUX","GILD","ADI","BKNG","MDLZ","PYPL","REGN","VRTX","PANW",
    "SNPS","KLAC","ADP","CDNS","MELI","LRCX","ISRG","FTNT","MNST","KDP",
    "CSGP","DXCM","CEG","CTSH","IDXX","FAST","ROST","VRSK","ODFL","PCAR",
    "BIIB","MCHP","NXPI","DLTR","WDAY","TEAM","CRWD","ZS","DDOG","SNOW",
]

DOW30 = [
    "AAPL","AMGN","AXP","BA","CAT","CRM","CSCO","CVX","DIS","DOW",
    "GS","HD","HON","IBM","JNJ","JPM","KO","MCD","MMM","MRK",
    "MSFT","NKE","PG","TRV","UNH","V","VZ","WMT","SHW","NVDA",
]

BROAD_ETFS = [
    "SPY","QQQ","IWM","DIA","VTI","VOO","IVV","VEA","EEM","VWO",
    "GLD","SLV","USO","TLT","HYG","LQD","VNQ","IYR","ARKK","ARKG",
    "ARKW","ARKF","TQQQ","SQQQ","SPXU","UPRO","SOXL","SOXS","TNA","TZA",
    "UVXY","VXX","VIXY","SVXY","BITO","GBTC","MARA","RIOT","CLSK",
]

SECTOR_ETFS = [
    "XLF","XLE","XLK","XLV","XLU","XLI","XLP","XLB","XLRE","XLY",
    "XLC","KRE","KBE","SOXX","SMH","IBB","XBI","XOP","OIH","ITB",
    "XRT","XHB","XME","GDX","GDXJ","SLX","MOO","XAR","IHI","IYT",
]

GROUPS = {
    "sp500":        {"label": "S&P 500",       "symbols": SP500,       "color": "#00c8f0"},
    "nasdaq100":    {"label": "NASDAQ 100",     "symbols": NASDAQ100,   "color": "#00e676"},
    "dow30":        {"label": "Dow Jones 30",   "symbols": DOW30,       "color": "#ffd600"},
    "broad_etfs":   {"label": "Broad ETFs",     "symbols": BROAD_ETFS,  "color": "#c084fc"},
    "sector_etfs":  {"label": "Sector ETFs",    "symbols": SECTOR_ETFS, "color": "#f97316"},
}

def get_universe(market: str) -> list:
    g = GROUPS.get(market)
    return g["symbols"] if g else []
