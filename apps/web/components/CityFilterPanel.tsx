"use client";

// 城市筛选三级联动面板：全国 → 热门/省份 → 城市
// 数据源：infra/classify/pcas.json（民政部行政区划）生成的 cityTree.ts
import { useMemo, useState } from "react";
import { PROVINCE_OF_CITY, HOT_CITIES } from "@/lib/cityTree";

export type CityOpt = { v: string; n: number };

export default function CityFilterPanel({
  opts,
  value,
  onChange,
}: {
  opts: CityOpt[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [openProv, setOpenProv] = useState<string | null>(null);
  const [showHot, setShowHot] = useState(true);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  const nationwide = opts.filter((o) => o.v === "全国");
  const hot = opts.filter((o) => HOT_CITIES.includes(o.v));
  // 省份分组（含海外兜底），按省岗位总数降序
  const byProv = useMemo(() => {
    const m = new Map<string, CityOpt[]>();
    for (const o of opts) {
      if (o.v === "全国" || HOT_CITIES.includes(o.v)) continue;
      const p = PROVINCE_OF_CITY[o.v] || "海外";
      if (!m.has(p)) m.set(p, []);
      m.get(p)!.push(o);
    }
    return [...m.entries()]
      .map(([prov, cities]) => ({
        prov,
        cities,
        total: cities.reduce((s, c) => s + c.n, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [opts]);

  const renderOpt = (o: CityOpt) => (
    <div
      key={o.v}
      className={"f-opt" + (value.includes(o.v) ? " on" : "")}
      onClick={() => toggle(o.v)}
    >
      <span className="cb">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="m5 12 4 4L19 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {o.v}
      <span className="n">{o.n}</span>
    </div>
  );

  return (
    <>
      {nationwide.length > 0 && (
        <>
          <div className="f-group">全国</div>
          {nationwide.map(renderOpt)}
        </>
      )}

      {hot.length > 0 && (
        <>
          <div
            className="f-group f-group-toggle"
            onClick={() => setShowHot(!showHot)}
          >
            热门城市
            <span className={"arr" + (showHot ? " on" : "")}>›</span>
          </div>
          {showHot && hot.map(renderOpt)}
        </>
      )}

      {byProv.map(({ prov, cities, total }) => (
        <div key={prov}>
          <div
            className={"f-prov" + (openProv === prov ? " on" : "")}
            onClick={() => setOpenProv(openProv === prov ? null : prov)}
          >
            <span>{prov}</span>
            <span className="n">{total}</span>
            <span className="arr">›</span>
          </div>
          {openProv === prov && (
            <div className="f-prov-city">{cities.map(renderOpt)}</div>
          )}
        </div>
      ))}
    </>
  );
}
