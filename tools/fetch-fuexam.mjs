import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Danh sách 4 đề WDU202c + 7 đề MLN122 (đã khử link trùng 371)
const DEFAULT_THREADS = [
  // === WDU202c (4 đề) ===
  {
    examTag: 'SP26-FE-RE',
    subject: 'wdu202c',
    url: 'https://fuexam.me/threads/wdu202c-sp26-fe-re.395/',
  },
  {
    examTag: 'SP26-FE',
    subject: 'wdu202c',
    url: 'https://fuexam.me/threads/wdu202c-sp26-fe.314/',
  },
  {
    examTag: 'SU26-FE-RE',
    subject: 'wdu202c',
    url: 'https://fuexam.me/threads/wdu202c-su26-fe-re.1115/',
  },
  {
    examTag: 'SU26-FE',
    subject: 'wdu202c',
    url: 'https://fuexam.me/threads/wdu202c-su26-fe.1024/',
  },

  // === MLN122 (9 đề) ===
  {
    examTag: 'FA26-FE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-fa26-fe.1249/',
  },
  {
    examTag: 'FA26-FE-RE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-fa26-fe-re.1254/',
  },
  {
    examTag: 'FA26-FE-C2',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-fa26-fe-c2.1474/',
  },
  {
    examTag: 'FA26-FE-C1',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-fa26-fe-c1.1473/',
  },
  {
    examTag: 'SU26-FE-C2',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-su26-fe-c2.812/',
  },
  {
    examTag: 'SP26-B5-FE-RE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-sp26-b5-fe-re.461/',
  },
  {
    examTag: 'SP26-B5-FE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-sp26-b5-fe.371/',
  },
  {
    examTag: 'SP26-C2-FE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-sp26-c2-fe.192/',
  },
  {
    examTag: 'SP26-C1-FE',
    subject: 'mln122',
    url: 'https://fuexam.me/threads/mln122-sp26-c1-fe.184/',
  },
];

const COOKIE_FILE = path.join(__dirname, '.cookie.txt');
const OUTPUT_ROOT = path.join(__dirname, 'raw-exams');

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Tự động bóc tách Cookie và User-Agent dù người dùng dán:
 * 1) Chuỗi cookie thô: xf_user=...; xf_session=...
 * 2) Dòng header: cookie: xf_user=...
 * 3) Nguyên khối "Copy as cURL (bash)" hoặc "Copy as cURL (cmd)" hoặc "Copy as fetch"
 */
function parseAuthFromCookieFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length === 0) {
    throw new Error(
      'File tools/.cookie.txt đang trống! Hãy dán Cookie hoặc lệnh "Copy as cURL" từ F12 Network trên fuexam.me vào tools/.cookie.txt.'
    );
  }

  const joined = lines.join('\n');
  let cookie = '';
  let userAgent = DEFAULT_UA;

  // Thử bắt từ cURL: -b '...' / -b "..." / -H 'cookie: ...' / -H "cookie: ..."
  const curlBMatch =
    joined.match(/(?:^|\s)-b\s+\^?"([^"]+)"/i) ||
    joined.match(/(?:^|\s)-b\s+'([^']+)'/i) ||
    joined.match(/--cookie\s+['"]([^'"]+)['"]/i);
  const curlHMatch =
    joined.match(/['"]cookie:\s*([^'"]+)['"]/i) ||
    joined.match(/['"]cookie['"]\s*:\s*['"]([^'"]+)['"]/i);

  if (curlBMatch) {
    cookie = curlBMatch[1];
  } else if (curlHMatch) {
    cookie = curlHMatch[1];
  } else {
    // Hỗ trợ cả việc copy bảng hoặc từng dòng từ tab Application -> Cookies (xf_user, xf_session, xf_csrf...)
    const cookiePairs = [];
    for (const line of lines) {
      if (/^cookie\s*:/i.test(line)) {
        cookie = line.replace(/^cookie\s*:\s*/i, '').trim();
        break;
      }
      if (/^-H\s+/i.test(line) || /^curl\s+/i.test(line)) {
        continue;
      }
      // Nếu dòng dạng "xf_user=abc; xf_session=def"
      if (line.includes('=') && (line.includes(';') || line.startsWith('xf_') || line.startsWith('cf_'))) {
        cookiePairs.push(line.replace(/^['"]|['"]$/g, '').replace(/;$/, '').trim());
        continue;
      }
      // Nếu copy dòng từ bảng Application -> Cookies: "xf_user \t 1234%2C..." hoặc "xf_user: 1234%2C..."
      const tableMatch = line.match(/^(xf_[a-z0-9_]+|cf_clearance)[\t :]+([^\t ;]+)/i);
      if (tableMatch) {
        cookiePairs.push(`${tableMatch[1]}=${tableMatch[2].trim()}`);
        continue;
      }
      // Nếu chỉ copy riêng cột Value của xf_user (luôn có dạng số + %2C hoặc dấu phẩy)
      if (/^\d+(?:%2C|,)[A-Za-z0-9_-]+$/i.test(line)) {
        cookiePairs.push(`xf_user=${line}`);
        continue;
      }
      // Nếu chỉ copy riêng cột Value của xf_session (chuỗi 26-45 ký tự chữ/số)
      if (/^[A-Za-z0-9_-]{26,45}$/.test(line)) {
        cookiePairs.push(`xf_session=${line}`);
        continue;
      }
    }
    if (!cookie && cookiePairs.length > 0) {
      cookie = cookiePairs.join('; ');
    }
  }

  // Khử escape của cURL cmd Windows (^" hoặc ^%;) nếu có
  cookie = cookie.replace(/\^"/g, '"').replace(/\^%/g, '%').replace(/\^&/g, '&').trim();

  const uaMatch =
    joined.match(/['"]user-agent:\s*([^'"]+)['"]/i) ||
    joined.match(/['"]user-agent['"]\s*:\s*['"]([^'"]+)['"]/i);
  if (uaMatch) {
    userAgent = uaMatch[1].replace(/\^/g, '').trim();
  }

  return { cookie, userAgent };
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripTags(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .trim()
  );
}

/**
 * Bóc danh sách ảnh đính kèm & link sidebar bình luận từ trang HTML của thread XenForo
 */
function parseThreadHtml(html, baseUrl) {
  const titleMatch =
    html.match(/<h1[^>]*class="[^"]*p-title-value[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<title>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : '';

  const fields = {};
  const dlRegex = /<dl[^>]*class="[^"]*pairs[^"]*"[^>]*>\s*<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>\s*<\/dl>/gi;
  let dlMatch;
  while ((dlMatch = dlRegex.exec(html)) !== null) {
    const k = stripTags(dlMatch[1]).replace(/:$/, '').trim();
    const v = stripTags(dlMatch[2]).trim();
    if (k && v) fields[k] = v;
  }

  // Ưu tiên khối message-attachments (tránh lỗi nested <article class="message-body"> cắt mất phần đính kèm!)
  const attachSectionMatch = html.match(
    /<section[^>]*class="[^"]*message-attachments[^"]*"[\s\S]*?<\/section>/i
  );
  const scopeHtml = attachSectionMatch ? attachSectionMatch[0] : html;

  const anchorRegex = /<a\b([^>]+)>([\s\S]*?)<\/a>/gi;
  const seenUrls = new Set();
  const items = [];

  let aMatch;
  while ((aMatch = anchorRegex.exec(scopeHtml)) !== null) {
    const attrs = aMatch[1];
    const inner = aMatch[2];

    const isLbOrAttachment =
      /js-lbImage|file-preview/i.test(attrs) ||
      /href=["'][^"']*\/attachments\//i.test(attrs);
    if (!isLbOrAttachment) continue;

    const hrefMatch =
      attrs.match(/(?:^|\s)href=["']([^"']+)["']/i) ||
      attrs.match(/(?:^|\s)data-src=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const rawHref = decodeHtmlEntities(hrefMatch[1]);
    if (
      !rawHref.includes('/attachments/') &&
      !rawHref.includes('/media/')
    ) {
      continue;
    }

    const imageUrl = new URL(rawHref, baseUrl).href;
    if (seenUrls.has(imageUrl)) continue;

    const sidebarMatch =
      attrs.match(/\bdata-lb-sidebar-href=["']([^"']+)["']/i) ||
      attrs.match(/\bdata-sidebar-href=["']([^"']+)["']/i);
    const sidebarUrl = sidebarMatch
      ? new URL(decodeHtmlEntities(sidebarMatch[1]), baseUrl).href
      : '';

    const titleAttrMatch =
      attrs.match(/\bdata-lb-caption-desc=["']([^"']+)["']/i) ||
      attrs.match(/\btitle=["']([^"']+)["']/i) ||
      inner.match(/\balt=["']([^"']+)["']/i);
    const fileName = titleAttrMatch
      ? decodeHtmlEntities(titleAttrMatch[1]).trim()
      : imageUrl.split('/').filter(Boolean).pop() || `question_${items.length + 1}.webp`;

    seenUrls.add(imageUrl);
    items.push({
      order: items.length + 1,
      fileName,
      imageUrl,
      sidebarUrl,
    });
  }

  return { title, fields, items };
}

/**
 * Bóc bình luận của sinh viên từ trang media / sidebar của từng câu hỏi
 */
function parseCommentsFromHtml(html) {
  const comments = [];

  // Mẫu 1: <article class="message message--simple ... " data-author="User"> ... <div class="bbWrapper">B</div>
  const articleRegex =
    /<(?:article|div)\b[^>]*?(?:data-author=["']([^"']+)["'][^>]*?)?class=["'][^"']*?(?:message--simple|xfmgComment|comment|contentRow)[^"']*?["'][^>]*>([\s\S]*?)<\/(?:article|div)>/gi;
  let m;
  while ((m = articleRegex.exec(html)) !== null) {
    let author = m[1] ? decodeHtmlEntities(m[1]).trim() : '';
    const block = m[2];
    if (!author) {
      const userMatch = block.match(/class=["'][^"']*username[^"']*["'][^>]*>([\s\S]*?)<\//i);
      if (userMatch) author = stripTags(userMatch[1]);
    }
    const bodyMatch = block.match(/<div[^>]*class=["'][^"']*bbWrapper[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (!bodyMatch) continue;
    const text = stripTags(bodyMatch[1]);
    if (
      text &&
      text !== 'Viết bình luận...' &&
      !comments.some((c) => c.author === author && c.text === text)
    ) {
      comments.push({ author, text });
    }
  }

  // Mẫu dự phòng nếu cấu trúc gọn hơn: tìm mọi cặp username + bbWrapper
  if (comments.length === 0) {
    const pairRegex =
      /class=["'][^"']*username[^"']*["'][^>]*>([\s\S]*?)<\/[\s\S]{1,1200}?<div[^>]*class=["'][^"']*bbWrapper[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
    while ((m = pairRegex.exec(html)) !== null) {
      const author = stripTags(m[1]);
      const text = stripTags(m[2]);
      if (
        text &&
        text !== 'Viết bình luận...' &&
        !comments.some((c) => c.author === author && c.text === text)
      ) {
        comments.push({ author, text });
      }
    }
  }

  return comments;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, options, maxRetries = 6) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.status === 429 || res.status === 502 || res.status === 503) {
        const retryHeader = res.headers.get('retry-after');
        const waitSec = retryHeader ? Math.min(30, Math.max(3, parseInt(retryHeader, 10) || 5)) : 4 + attempt * 3;
        process.stdout.write(`\n  ⏳ Server giới hạn tốc độ (HTTP ${res.status}), đợi ${waitSec}s rồi thử lại...`);
        await sleep(waitSec * 1000);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt === 0 || attempt === maxRetries) throw err;
      const waitSec = 2 + attempt * 2;
      await sleep(waitSec * 1000);
    }
  }
  throw new Error(`Quá số lần thử lại khi gọi ${url}`);
}

/**
 * Tải file ảnh gốc từ fuexam.me -> tự theo 302 Redirect sang s3.cloudfly.vn (không bị chặn CORS như trình duyệt)
 */
async function downloadAttachmentImage(imageUrl, refererUrl, auth, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 500) {
    return { skipped: true, bytes: fs.statSync(destPath).size };
  }

  const headers1 = {
    'User-Agent': auth.userAgent,
    Referer: refererUrl,
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  };
  if (auth.cookie) {
    headers1.Cookie = auth.cookie;
  }

  const res1 = await fetchWithRetry(imageUrl, {
    method: 'GET',
    redirect: 'manual',
    headers: headers1,
  });

  let finalRes = res1;

  if (res1.status >= 300 && res1.status < 400) {
    const location = res1.headers.get('location');
    if (!location) {
      throw new Error(`Redirect ${res1.status} nhưng thiếu header Location cho ${imageUrl}`);
    }
    const targetUrl = new URL(location, imageUrl).href;
    // Khi tải trên S3 CloudFly presigned URL, không gửi kèm Cookie của fuexam.me
    finalRes = await fetchWithRetry(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': auth.userAgent,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
  }

  if (!finalRes.ok) {
    throw new Error(`HTTP ${finalRes.status} khi tải ảnh ${imageUrl}`);
  }

  const contentType = finalRes.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error(
      `Server trả về trang HTML thay vì ảnh (Cookie có thể đã hết hạn hoặc chưa đăng nhập) cho ${imageUrl}`
    );
  }

  const buf = Buffer.from(await finalRes.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  await sleep(600); // Giãn nhịp ~600ms giữa các request redirect trên fuexam.me để vừa khít rate limit (~100 req/phút)
  return { skipped: false, bytes: buf.length };
}

async function fetchQuestionComments(sidebarUrl, refererUrl, auth) {
  if (!sidebarUrl) return [];
  try {
    const res = await fetch(sidebarUrl, {
      headers: {
        Cookie: auth.cookie,
        'User-Agent': auth.userAgent,
        Referer: refererUrl,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    return parseCommentsFromHtml(html);
  } catch {
    return [];
  }
}

async function runPool(items, concurrency, worker) {
  let idx = 0;
  const results = new Array(items.length);
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const withComments = args.includes('--comments');
  const subjectFilter = args.find((a) => !a.startsWith('--'))?.toLowerCase() || '';

  const auth = parseAuthFromCookieFile(COOKIE_FILE);
  if (auth.cookie) {
    console.log(`✓ Đã nạp Cookie (${auth.cookie.length} ký tự) từ tools/.cookie.txt`);
  } else {
    console.log(
      '⚠ Lưu ý: Lệnh cURL trong tools/.cookie.txt chưa có trường cookie (Chrome mới ẩn cookie khi Copy as cURL thường). Đang thử truy cập trực tiếp...'
    );
  }

  const subjectsMap = new Map();
  for (const thread of DEFAULT_THREADS) {
    if (subjectFilter && thread.subject.toLowerCase() !== subjectFilter) continue;
    if (!subjectsMap.has(thread.subject)) {
      subjectsMap.set(thread.subject, []);
    }
    subjectsMap.get(thread.subject).push(thread);
  }

  for (const [subjectId, threads] of subjectsMap.entries()) {
    const subjectDir = path.join(OUTPUT_ROOT, subjectId);
    fs.mkdirSync(subjectDir, { recursive: true });

    const subjectManifest = {
      subject: subjectId,
      harvestedAt: new Date().toISOString(),
      exams: [],
    };

    for (let tIdx = 0; tIdx < threads.length; tIdx++) {
      const thread = threads[tIdx];
      console.log(
        `\n=== [${subjectId.toUpperCase()} ${tIdx + 1}/${threads.length}] Đang quét đề ${thread.examTag}: ${thread.url} ===`
      );

      const reqHeaders = {
        'User-Agent': auth.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      };
      if (auth.cookie) {
        reqHeaders.Cookie = auth.cookie;
      }

      const threadRes = await fetchWithRetry(thread.url, { headers: reqHeaders });

      if (!threadRes.ok) {
        throw new Error(`HTTP ${threadRes.status} khi truy cập thread ${thread.url}`);
      }

      const threadHtml = await threadRes.text();
      const { title, fields, items } = parseThreadHtml(threadHtml, thread.url);

      if (items.length === 0) {
        throw new Error(
          `Không tìm thấy ảnh đính kèm nào trong ${thread.url}. Trang này yêu cầu Cookie đăng nhập (xf_user / xf_session).`
        );
      }

      const examDir = path.join(subjectDir, thread.examTag);
      fs.mkdirSync(examDir, { recursive: true });

      console.log(
        `  Tìm thấy ${items.length} câu hỏi (${title}). Đang tải ảnh (song song 2 luồng chống 429)...`
      );

      let downloadedCount = 0;
      let skippedCount = 0;
      let commentTotal = 0;

      const questionsMeta = await runPool(items, 2, async (item) => {
        const padOrder = String(item.order).padStart(3, '0');
        const ext = path.extname(item.fileName) || '.webp';
        const localFileName = `q${padOrder}${ext}`;
        const localAbsPath = path.join(examDir, localFileName);
        const localRelPath = path.posix.join(
          'tools',
          'raw-exams',
          subjectId,
          thread.examTag,
          localFileName
        );

        const dlResult = await downloadAttachmentImage(item.imageUrl, thread.url, auth, localAbsPath);
        const comments = withComments
          ? await fetchQuestionComments(item.sidebarUrl, thread.url, auth)
          : [];

        if (dlResult.skipped) skippedCount++;
        else downloadedCount++;
        commentTotal += comments.length;

        process.stdout.write(
          `\r  -> Tiến độ ${thread.examTag}: ${downloadedCount + skippedCount}/${items.length} ảnh (mới: ${downloadedCount}, có sẵn: ${skippedCount})`
        );

        return {
          order: item.order,
          examTag: thread.examTag,
          originalFileName: item.fileName,
          localFile: localRelPath,
          imageUrl: item.imageUrl,
          sidebarUrl: item.sidebarUrl,
          comments,
        };
      });

      process.stdout.write('\n');

      const examMeta = {
        examTag: thread.examTag,
        examCode: fields['Mã Đề'] || thread.examTag,
        semester: fields['Học kỳ'] || '',
        examDate: fields['Thời Gian'] || '',
        title,
        threadUrl: thread.url,
        totalQuestions: questionsMeta.length,
        totalComments: commentTotal,
        questions: questionsMeta,
      };

      fs.writeFileSync(path.join(examDir, 'exam.json'), JSON.stringify(examMeta, null, 2), 'utf8');

      subjectManifest.exams.push(examMeta);
      console.log(
        `✓ Hoàn tất đề ${thread.examTag}: ${questionsMeta.length} ảnh lưu tại tools/raw-exams/${subjectId}/${thread.examTag}/`
      );
    }

    const manifestPath = path.join(subjectDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(subjectManifest, null, 2), 'utf8');
    console.log(
      `\n🎉 ĐÃ TẢI XONG MÔN ${subjectId.toUpperCase()} (${subjectManifest.exams.length} đề)! Manifest: ${manifestPath}`
    );
  }
}

main().catch((err) => {
  console.error('\n❌ LỖI:', err.message);
  process.exit(1);
});
