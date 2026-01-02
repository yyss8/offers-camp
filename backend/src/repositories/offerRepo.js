function buildQuery(db, userId, { query, card, source }) {
  const base = db("offers")
    .where("user_id", userId)
    .andWhere(builder => {
      builder.whereNull("expires").orWhere("expires", ">=", db.fn.now());
    });
  if (query) {
    base.andWhere(builder =>
      builder.where("title", "like", `%${query}%`).orWhere("summary", "like", `%${query}%`)
    );
  }
  if (card && card !== "all") {
    base.andWhere("card_num", card);
  }
  if (source && source !== "all") {
    base.andWhere("source", source);
  }
  return base;
}

function parseJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return [];
  }
}

function toDateString(value) {
  if (!value) return null;
  const raw = String(value).replace(/^Expires\s+/i, "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) {
    year += 2000;
  }
  const mm = String(Number(match[1])).padStart(2, "0");
  const dd = String(Number(match[2])).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function createOfferRepo(db) {
  return {
    async listCards(userId) {
      const rows = await db("offers")
        .distinct("card_num", "source", "card_label")
        .where("user_id", userId)
        .whereNotNull("card_num")
        .whereNot("card_num", "")
        .orderBy("source")
        .orderBy("card_num");
      return rows.map(row => ({
        cardNum: row.card_num,
        source: row.source || "",
        cardLabel: row.card_label || ""
      }));
    },
    async listSources(userId) {
      const rows = await db("offers")
        .distinct("source")
        .where("user_id", userId)
        .whereNotNull("source")
        .whereNot("source", "")
        .orderBy("source");
      return rows.map(row => row.source);
    },
    async countTotals(userId, filters) {
      const base = buildQuery(db, userId, filters);
      const totalRow = await base
        .clone()
        .countDistinct({ total: "id" })
        .first();
      const totalRows = await base.clone().count({ total_rows: "*" }).first();
      return {
        total: Number(totalRow?.total || 0),
        totalRows: Number(totalRows?.total_rows || 0)
      };
    },
    async listOfferIds(userId, filters, { limit, offset }) {
      const rows = await buildQuery(db, userId, filters)
        .select(
          "id",
          db.raw("MIN(expires) as expiry_date")
        )
        .groupBy("id")
        .orderByRaw("(expiry_date IS NULL), expiry_date ASC, id")
        .limit(limit)
        .offset(offset);
      return rows.map(row => row.id);
    },
    async listOffersByIds(userId, filters, ids) {
      const rows = await buildQuery(db, userId, filters)
        .select(
          "id",
          "title",
          "summary",
          "image",
          "expires",
          "categories",
          "channels",
          "enrolled",
          "source",
          "card_num",
          "card_label"
        )
        .whereIn("id", ids)
        .orderByRaw(
          "(expires IS NULL), expires ASC, id"
        );
      return rows.map(row => ({
        ...row,
        categories: parseJson(row.categories),
        channels: parseJson(row.channels)
      }));
    },
    async upsertOffers(userId, offers) {
      if (!offers.length) return 0;
      const rows = offers.map(offer => ({
        id: offer.id,
        user_id: userId,
        title: offer.title,
        summary: offer.summary || offer.description || "",
        image: offer.image || "",
        expires: toDateString(offer.expires || offer.expiresAt),
        categories: JSON.stringify(offer.categories || []),
        channels: JSON.stringify(offer.channels || []),
        enrolled: !!offer.enrolled,
        source: offer.source || offer.bank || "amex",
        card_num: offer.cardNum || offer.card_num || "",
        card_label: offer.cardLabel || offer.card_label || ""
      }));
      await db("offers")
        .insert(rows)
        .onConflict(["id", "card_num", "user_id"])
        .merge({
          title: db.raw("VALUES(title)"),
          summary: db.raw("VALUES(summary)"),
          image: db.raw("VALUES(image)"),
          expires: db.raw("VALUES(expires)"),
          categories: db.raw("VALUES(categories)"),
          channels: db.raw("VALUES(channels)"),
          enrolled: db.raw("VALUES(enrolled)"),
          source: db.raw("VALUES(source)"),
          card_label: db.raw("VALUES(card_label)")
        });
      return rows.length;
    },
    async deleteMissingByCard(userId, card, ids) {
      if (!ids.length) {
        await db("offers").where({ user_id: userId, card_num: card }).del();
        return;
      }
      await db("offers")
        .where({ user_id: userId, card_num: card })
        .whereNotIn("id", ids)
        .del();
    }
  };
}
