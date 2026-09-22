import { zoneForCity, ZONES } from "../../js/catalog.js";
import { orderWeight, goodsTotal } from "../catalog-store.js";
import { isMakhachkala } from "./util.js";
import * as pickup from "./pickup.js";
import * as yandex from "./yandex.js";
import * as turti from "./turti.js";
import * as ozon from "./ozon.js";
import * as cdek from "./cdek.js";
import * as post from "./post.js";

const LOCAL = [pickup, yandex, turti];
const REMOTE = [ozon, cdek, post];

export async function resolveDelivery(body) {
  const items = body.items || [];
  const city = String(body.city || "").trim();
  if (!city) return { ok: false, error: "Укажите город" };

  const ctx = {
    city,
    cityCode: body.cityCode || null,
    postIndex: body.postIndex || null,
    postal: body.postal || null,
    weightKg: await orderWeight(items),
    goods: await goodsTotal(items),
    payMethod: body.payMethod || "online",
  };

  let options = [];

  if (isMakhachkala(city)) {
    for (const adapter of LOCAL) {
      const opts = await adapter.getOptions(ctx);
      options.push(...opts);
    }
  } else {
    /* Порядок на экране: Ozon → СДЭК → Почта. Показываем только то, что вернул API. */
    for (const adapter of REMOTE) {
      const opts = await adapter.getOptions(ctx);
      for (const o of opts) {
        if (!options.some((x) => x.method === o.method)) options.push(o);
      }
    }
  }

  options = options.filter((o) => !o.unavailable);

  const zone = zoneForCity(city);
  const zoneName = ZONES[zone]?.name || "";

  if (!options.length) {
    const whatsappUrl = "https://wa.me/79282197962";
    return {
      ok: true,
      options: [],
      zone,
      zoneName,
      anyEstimated: false,
      message: "Не нашли удобный способ доставки? Напишите TURTI в WhatsApp.",
      whatsappUrl,
    };
  }

  return {
    ok: true,
    options,
    zone,
    zoneName,
    cityCode: ctx.cityCode,
    anyEstimated: options.some((o) => o.estimated),
  };
}

export async function resolvePvz(provider, city, cityCode) {
  if (provider === "ozon") return ozon.getPoints(city);
  if (provider === "cdek") return cdek.getPoints(city, cityCode);
  return [];
}

export function findOption(options, method) {
  return (options || []).find((o) => o.method === method) || null;
}
