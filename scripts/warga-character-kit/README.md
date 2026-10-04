# Warga Character Kit — karakter modular untuk virtual-warga-discord

Semua sprite memakai format yang sama persis dengan `public/characters/char_N.png` di repo:

- Sheet **112×96 px** = 7 kolom × 3 baris, tiap frame **16×32 px** (ditampilkan 3× = 48×96).
- Baris: `down` (hadap bawah), `up` (hadap atas), `right` (hadap kanan; kiri = dicerminkan CSS).
- Kolom: `walk0, walk1, walk2` (jalan), `type0, type1` (mengetik / saat chat), `read0, read1` (cadangan, duduk diam).

Karena tiap item adalah satu sheet penuh dengan layout yang sama, karakter dibuat dengan
**menumpuk sheet** — animasi jalan dan duduk yang sudah ada di repo langsung berlaku untuk semua layer.

## Isi

| Kategori    | Jumlah | Lokasi                                   |
|-------------|-------:|------------------------------------------|
| Body / Skin | 6      | `kit/body/<id>.png`                      |
| Eyes        | 10     | `kit/eyes/<id>.png`                      |
| Hair        | 25     | `kit/hair/<warna>/<id>.png`              |
| Hair Color  | 12     | folder `kit/hair/<warna>/`               |
| Top / Shirt | 25     | `kit/top/<id>.png`                       |
| Bottom      | 15     | `kit/bottom/<id>.png`                    |
| Shoes       | 8      | `kit/shoes/<id>.png`                     |
| Hat         | 12     | `kit/hat/<id>.png`                       |
| Accessories | 15     | `kit/accessories/<id>.png`               |

- `kit/manifest.json` — daftar semua id, urutan layer, dan aturan topi.
- `characters/char_0..23.png` — 24 karakter jadi (sudah digabung), bisa langsung menggantikan
  `public/characters/char_N.png`. Resepnya ada di `characters/specs.json`.
- `preview/` — katalog, animasi, dan tangkapan layar dari aplikasinya.
- `integration/` — `character-kit.ts` dan `character-kit.patch`.

## Urutan layer (bawah → atas)

1. accessories `_back` (cape, angel_wings)
2. hair `_back` (rambut panjang, ponytail, twin tails)
3. body
4. eyes
5. shoes
6. bottom
7. top
8. accessories `slot: "mid"`
9. hair
10. hat
11. accessories `slot: "front"`

**Topi + rambut:** tiap rambut punya varian `__hat` (bagian atasnya dipotong). Pakai varian itu
kalau topinya bertanda `hairUnderHat: true` di manifest, supaya rambut tidak menembus topi.

## Memasang di repo

1. Salin folder `kit/` ke `public/characters/kit/`.
2. Terapkan patch: `git apply integration/character-kit.patch`
   (menambah `src/game/character-kit.ts` dan mengubah beberapa baris di `src/OfficeWorld.tsx`).

Setelah itu tiap member Discord otomatis mendapat karakter unik yang stabil, diturunkan dari
hash id-nya (`characterFor(hash)`), menggantikan 6 sprite × 6 warna yang lama.

Untuk karakter pilihan sendiri, buat `CharacterSpec` lalu pakai `characterBackground(spec)`
sebagai `background-image` pada `.world-agent-sprite`:

```ts
const look = characterBackground({
  body: "tan", eyes: "classic", hair: "bob", hairColor: "black",
  top: "batik_shirt", bottom: "sarong", shoes: "sandals",
  hat: "blangkon", accessories: ["glasses"],
});
```

Sprite ini gambar asli (bukan turunan MetroCity / Pixel Agents), jadi tidak menambah kewajiban
lisensi pihak ketiga.
