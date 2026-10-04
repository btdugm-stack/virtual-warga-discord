# Warga Discord: a pixel office that shows live Discord activity

English · [简体中文](#简体中文) · [日本語](#日本語)

> The English section describes this project. The Chinese and Japanese sections below
> still describe the original Draftroom asset pack it was built from.

A top-down pixel office whose nine rooms are Discord servers and channels. Members who are online sit in
their room, walk to a voice channel's room when they join it, get a "Sedang Gibah di #channel" bubble when
they write, and move to the AFK room when they go idle or offline. A side panel lists the activity ("Aktivitas
Rasan-rasan") and who is where. Which server or channel each room shows is set in a password-protected
settings panel.

Message text is never read or shown: the bot does not request the Message Content intent.

## Run it locally

Requires Node 22.9 or newer.

```bash
npm install
cp .env.example .env     # then fill it in, see below
npm run server           # the bot and the API, on http://localhost:8787
npm run dev              # in a second terminal: the site, on http://localhost:5173
```

With `DISCORD_TOKEN` left empty the server runs in **demo mode**: invented servers and members, so the
office and the settings panel can be tried before a bot exists.

## Create the bot

1. Open <https://discord.com/developers/applications>, create an application, and open its **Bot** page.
2. Under **Privileged Gateway Intents**, turn on **Presence Intent** and **Server Members Intent**.
   Leave Message Content Intent off.
3. Press **Reset Token**, copy the token, and put it in `.env` as `DISCORD_TOKEN`. Treat it like a password.
4. Under **OAuth2 → URL Generator**, tick the `bot` scope and the **View Channels** permission, open the
   generated link, and add the bot to each server you want to show. You need Manage Server there.
5. Set `ADMIN_PASSWORD` in `.env`, restart `npm run server`, and open **Pengaturan ruangan** in the site.

The bot only sees channels it is allowed to view. To show a private channel, give the bot's role access to it.

## Rooms

Each of the nine rooms shows one of:

| Setting | Who sits there |
|---|---|
| A server | Members of that server who are not offline |
| A voice channel | Whoever is in that voice channel |
| A text channel | Whoever wrote there in the last five minutes |
| AFK room | Idle and offline members of any server that is shown |
| Empty | Nobody |

A member appears in one room only, chosen in this order: their voice channel, the text channel they last
wrote in, the AFK room, then their server. Offline members gather in the AFK room and are shown only when
one exists; in a server above 2,000 members the offline list is not loaded. Until bindings are saved, rooms are filled automatically, one
server per room. A room has 12 to 22 seats depending on its furniture; anyone beyond that is counted as
"+N" on the room label.

## Characters

Each member's character is assembled from the character kit in `server/character-kit/`: 6 skin tones, 10
eyes, 25 hair styles in 12 colors, 25 tops, 15 bottoms, 8 shoes, 12 hats, and 15 accessories (up to three
at once). Without a choice the character is derived from the member and stays the same across restarts.
A member can also wear their Discord profile picture as the face. That is off until they turn it on; it
covers the face only, so hair and hat stay visible.

A member changes their own with the `/karakter` command in Discord. It opens a picker only they can see:

- a picture of the character from the front, the back, and the side;
- a menu choosing which part to change, and a menu with that part's options;
- buttons: **Pakai** applies, **Acak** draws a random character, **Bawaan** brings back the automatic one,
  **Foto profil** wears or drops the profile picture, **Batal** closes the picker.

Nothing changes in the office until **Pakai** is pressed. The **Karakter** button on the site explains the
command and shows the kit's catalog. The command is registered in every server the bot is in when the server
process starts; it does not answer while the process is down.

How it is put together:

- Every kit part is a full sprite sheet in the layout the office animates (112×96, seven 16×32 frames in
  three rows). `server/character-kit.mjs` stacks the parts in the order `character-kit/manifest.json` gives
  and serves the result at `/api/character/<code>.png`. Adding a part means adding its sheet and its
  manifest entry; nothing else names the parts.
- Choices are saved in `server/data/characters.json`, keyed by Discord user id and naming each part by id.
- Profile pictures are fetched by the server and passed on under the member's public id, so the picture's
  real address (which contains the Discord id) never reaches a browser.
- The kit came with its own README, catalog, and ready-made examples in `scripts/warga-character-kit/`.
  That README says the art is original, not derived from MetroCity or Pixel Agents.

## Publish it

`npm run build`, then `npm start` on the host. That one process holds the bot connection, serves the API,
and serves the built site from `dist/`, so there is nothing else to deploy.

- It needs a host that keeps a Node process running (a VPS, Railway, Fly.io, Render). Static hosting,
  serverless functions, and PHP shared hosting will not work: the bot needs a permanent connection.
- Set `DISCORD_TOKEN`, `ADMIN_PASSWORD`, and `PORT` as environment variables on the host, and serve it over HTTPS.
- Room bindings, the furniture layout, and character choices are saved in `server/data/`. Keep that directory on persistent storage.
- If a reverse proxy sits in front, it must not buffer `/api/events` (the live stream).
- Everyone who opens the site sees the display names and activity of members in the shown servers. Tell
  those servers' members before making it public. A profile picture is shown only for a member who turned
  it on in the `/karakter` picker. Discord user ids are not sent to browsers.

## What's inside

| Path | Contents |
|---|---|
| `server/index.mjs` | HTTP server: public snapshot and live stream, admin login and room bindings, static files |
| `server/world.mjs` | The live picture of Discord and the rules for who sits in which room |
| `server/discord-source.mjs`, `server/demo-source.mjs` | The gateway connection, and the invented data used without a token |
| `server/config-store.mjs`, `server/layout-store.mjs`, `server/character-store.mjs` | Validation and storage of the room bindings, the furniture layout, and members' character choices |
| `server/character-kit/`, `server/character-kit.mjs` | The layered character art, and the code that stacks it into sprite sheets and previews |
| `server/karakter-command.mjs` | The `/karakter` command and its picker |
| `src/discord/` | Snapshot types, the stream hook, and the Discord-related copy |
| `src/App.tsx`, `src/SettingsPanel.tsx`, `src/CharacterGuide.tsx`, `src/app.css` | The shell: room strip, activity feed, roster, the settings dialog, and the character guide |
| `src/game/office-world.ts` | The 72×30 world: rooms, walls, doors, seats, furniture, protected walkways |
| `src/OfficeWorld.tsx` | The renderer: seating, walking, arrivals and departures, and the furniture editor |
| `src/company.config.ts` | The site name, 19 theme color tokens, and the five work rooms' default names |
| `public/characters`, `public/office-assets` | The kit's catalog picture, six fallback sprites, and furniture art (the last two third-party, see [THIRD-PARTY.md](THIRD-PARTY.md)) |
| `design/`, `guide/` | Design notes and build notes from the original pack; they predate the Discord integration |

## Limits

- The kit's parts are named by their English ids in the picker ("Batik shirt", "Flat top").
- A profile picture is shown at 32 pixels, over the character's face, and not at all from behind.
- The six older sprites in `public/characters` are only drawn when the server is older than the page.
- The new Discord copy is in Indonesian and English. Korean, Chinese, and Vietnamese show English for it.
- The furniture layout is one shared layout. Anyone can try the editor, but only a signed-in admin can save;
  a saved layout is stored in `server/data/layout.json` and shown to every visitor.
- One admin password, no per-user accounts.

## Rights

- The pixel art and parts of the adapted layout/movement logic come from third-party projects and
  follow their original licenses — see [THIRD-PARTY.md](THIRD-PARTY.md) and
  [`public/third-party-notices.txt`](public/third-party-notices.txt) (authoritative).
- Everything else in this repository is published for viewing and learning. Redistribution or
  commercial use requires permission.

---

## 简体中文

自上而下像素办公室的**设计资源包与动作演示** — 来自 AI 内容制作应用「像素公司(Draftroom)」的
办公室画面。72×30 瓦片世界、角色移动、座位与漫步规则、家具编辑器，全部可在浏览器中运行。

### 运行

```bash
npm install
npm run dev
```

在浏览器中打开 http://localhost:5173。

- 顶部工具栏可切换**语言**（英语、中文、韩语、越南语、印尼语）和**状态预览**（待机 ↔ 各房间运行中）。
- 点击 **Customize my office（装扮我的办公室）** 打开家具编辑器：三种风格预设、人数滑块（5–35 人）、
  可摆放的家具目录。

### 包含内容

| 路径 | 内容 |
|---|---|
| `src/game/office-world.ts` | 72×30 世界：房间、墙、门、座位、家具、受保护通道 |
| `src/OfficeWorld.tsx` | 渲染器：角色移动、漫步、家具编辑器 |
| `src/company.config.ts` | 19 个主题色令牌、五个房间、五种语言的员工名册 |
| `public/characters`、`public/office-assets` | 像素角色与家具素材（第三方 — 见 [THIRD-PARTY.md](THIRD-PARTY.md)） |
| `design/` | 设计文档：调色板、平面布局理念、界面原则 |
| `guide/` | 如何用 Claude Code 构建本项目 |

### 不包含

本公开仓库和演示**不包含** AI 内容生成功能（主题分析、创意生成、脚本撰写）。
本资源包仅包含视觉世界及其动作。

### 权利说明

- 像素素材及部分改编的布局/移动逻辑来自第三方项目，遵循其原始许可证 —
  见 [THIRD-PARTY.md](THIRD-PARTY.md) 与 [`public/third-party-notices.txt`](public/third-party-notices.txt)（以后者为准）。
- 本仓库其余内容仅供浏览与学习。再分发或商业使用需获得许可。

---

## 日本語

トップダウン・ピクセルオフィスの**デザインアセットパック＆モーションデモ** — AI コンテンツ制作
アプリ「Pixel Company (Draftroom)」のオフィス画面です。72×30 タイルのワールド、キャラクターの移動、
座席と巡回のルール、家具エディターがすべてブラウザ上で動きます。

### 実行方法

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開きます。

- 上部バーで**言語**（英語・中国語・韓国語・ベトナム語・インドネシア語）と**状態プレビュー**
  （待機 ↔ 各ルーム稼働中）を切り替えられます。
- **Customize my office（オフィスをカスタマイズ）** をクリックすると家具エディターを試せます：
  スタイルプリセット 3 種、人数スライダー（5〜35 人）、配置できる家具カタログ。

### 収録内容

| パス | 内容 |
|---|---|
| `src/game/office-world.ts` | 72×30 ワールド：部屋・壁・ドア・座席・家具・保護された通路 |
| `src/OfficeWorld.tsx` | レンダラー：キャラクター移動、巡回、家具エディター |
| `src/company.config.ts` | テーマカラートークン 19 種、5 つの部屋、5 言語のスタッフ名簿 |
| `public/characters`、`public/office-assets` | ピクセルスプライトと家具アート（サードパーティ — [THIRD-PARTY.md](THIRD-PARTY.md) 参照） |
| `design/` | デザインドキュメント：パレット、フロアプランの考え方、画面の原則 |
| `guide/` | Claude Code でどのように作られたか |

### 含まれないもの

この公開リポジトリおよびデモには、AI コンテンツ機能（トピック分析・アイデア生成・台本作成）は
**含まれていません**。本パックに含まれるのはビジュアルワールドとそのモーションのみです。

### 権利について

- ピクセルアートおよび一部の改変されたレイアウト／移動ロジックはサードパーティ製プロジェクトに
  由来し、それぞれのライセンスに従います — [THIRD-PARTY.md](THIRD-PARTY.md) と
  [`public/third-party-notices.txt`](public/third-party-notices.txt)（正本）を参照してください。
- その他の内容は閲覧・学習目的で公開しています。再配布や商用利用には許可が必要です。
