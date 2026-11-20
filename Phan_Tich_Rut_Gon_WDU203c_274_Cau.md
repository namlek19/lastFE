# PHÂN TÍCH RÚT GỌN NGÂN HÀNG CÂU HỎI WDU203c (274 CÂU)

Tổng hợp kết quả rút gọn 2 mức độ (**Lazy** và **Lazy Max**) cho toàn bộ **274 câu hỏi** trong [wdu203c.json](file:///c:/FPT/lastFE/src/data/wdu203c.json) *(UI/UX Design & User Research — 6 Course Coursera)*.

## I. Bảng tổng hợp số câu rút gọn theo 6 Course

| Course | Tên Course | Gốc | **Lazy** *(Ít vừa — Giữ 100% ý độc lập)* | **Lazy Max** *(Ít nhất — Học lõi để suy luận)* |
| :--- | :--- | :---: | :---: | :---: |
| **Course 1** | Introduction to UX Principles & Processes | **48** | **41 câu** *(rút 7 / -14.6%)* | **22 câu** *(rút 26 / -54.2%)* |
| **Course 2** | Understanding User Needs | **50** | **37 câu** *(rút 13 / -26.0%)* | **17 câu** *(rút 33 / -66.0%)* |
| **Course 3** | Evaluating Designs with Users | **40** | **36 câu** *(rút 4 / -10.0%)* | **14 câu** *(rút 26 / -65.0%)* |
| **Course 4** | UX Design: From Concept to Prototype | **60** | **48 câu** *(rút 12 / -20.0%)* | **16 câu** *(rút 44 / -73.3%)* |
| **Course 5** | UX Design Concept & Capstone Case Studies | **15** | **12 câu** *(rút 3 / -20.0%)* | **7 câu** *(rút 8 / -53.3%)* |
| **Course 6** | UX Research at Scale: Surveys, Analytics, Online Testing | **61** | **55 câu** *(rút 6 / -9.8%)* | **26 câu** *(rút 35 / -57.4%)* |
| **TỔNG CỘNG** | **Toàn bộ ngân hàng đề `wdu203c.json`** | **274** | **229 câu** *(rút 45 / -16.4%)* | **102 câu** *(rút 172 / -62.8%)* |

> **Lưu ý đặc thù của bộ đề WDU203c (đã giữ cố định trong `Lazy Max`):**
> - `wdu-221` *(Course 6)*: Đáp án bộ đề chọn **Sampling error** cho trường hợp cách hỏi bỏ sót nhóm lớn trong tổng thể (thay vì Coverage error).
> - **Course 5 (7 câu `Lazy Max`):** Giữ toàn bộ các câu gắn với tình huống/ảnh/file đính kèm đặc thù của Capstone Coursera (`wdu-202`, `wdu-203`, `wdu-204`, `wdu-208`, `wdu-209`, `wdu-211`, `wdu-212`).

---

## II. Bảng dự đoán điểm & % đạt mốc (Đề 60 câu: 10 – 11 – 9 – 13 – 4 – 13)

- **KB1 (Học vẹt):** Chỉ nhớ câu hỏi + đáp án, bỏ qua phần giải thích.
- **KB2 (Học đúng cách):** Nhớ chắc câu hỏi + đọc kỹ phần giải thích + biết loại trừ cơ bản.
- **KB3 (Học hiểu sâu):** Nắm chắc bản chất UX + phần giải thích + suy luận tốt sang câu tương tự.

| Chế độ (Số câu học) | Cách học | Điểm trung bình *(khoảng phổ biến)* | % Qua môn ($\ge 5$) | % Đạt $\ge 7$ | % Đạt $\ge 8$ | % Đạt $\ge 9$ |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Lazy**<br>*(229 / 274 câu)* | **KB1** *(Học vẹt)* | **8.42** *(7.83 – 9.00)* | 100% | 99.8% | 86.0% | 14.2% |
| | **KB2** *(Kỹ giải thích)* | **9.54** *(9.17 – 9.83)* | 100% | 100% | 100% | **97.9%** |
| | **KB3** *(Hiểu sâu)* | **9.77** *(9.50 – 10.0)* | 100% | 100% | 100% | **100%** |
| **Lazy Max**<br>*(102 / 274 câu)* | **KB1** *(Học vẹt)* | **6.17** *(5.33 – 7.00)* | 97.7% | 10.8% | 0.2% | 0% |
| | **KB2** *(Kỹ giải thích)* | **8.32** *(7.67 – 8.83)* | 100% | 99.7% | **80.5%** | 10.0% |
| | **KB3** *(Hiểu sâu)* | **9.00** *(8.50 – 9.50)* | 100% | 100% | 99.6% | **60.0%** |

---

## III. Chi tiết rút gọn từng Course (Ánh xạ đầy đủ 274 câu)

### 1. Course 1: Introduction to UX Principles & Processes — *Tổng: 48 câu*
- **Lazy:** Giữ **41 câu** / Rút **7 câu** *(-14.6%)*.
- **Lazy Max:** Giữ **22 câu** / Rút **26 câu** *(-54.2%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (22 câu)** | **Lazy — Giữ thêm (19 câu)** *(Suy được từ Lazy Max)* | **Rút gọn ngay từ Lazy (7 câu)** *(Trùng / có sẵn trong giải thích)* |
| :--- | :--- | :--- | :--- |
| **1.1. Tổng quan UX & Quy trình lặp** *(12 câu)* | `wdu-001` (3 lý do UX khó, KHÔNG phải thiếu quy trình)<br>`wdu-006` (Spiral model: lặp + tiến tới đích)<br>`wdu-008` (4 thành phần UX: Value, Usability, Desirability, Adoptability) | `wdu-003` (UX là end-to-end)<br>`wdu-004` (Fail early and often)<br>`wdu-005` (Stylize không phải pha lặp)<br>`wdu-007` (UX Research methods)<br>`wdu-009` (Adoptability $\leftarrow$ từ `wdu-008`)<br>`wdu-011` (Design không chỉ thẩm mỹ)<br>`wdu-012` (Định giá bán không thuộc UX) | `wdu-002` (Không cần bằng tâm lý học)<br>`wdu-010` (Khóa học có hands-on) |
| **1.2. Prototyping, Sketching & Ideation** *(8 câu)* | `wdu-013` (Reification = biến ý tưởng thành cụ thể)<br>`wdu-014` (Bill Moggridge định nghĩa Prototype)<br>`wdu-016` (Bill Buxton: Sketching là trung tâm) | `wdu-015` (Lo-fi không trau chuốt font/màu)<br>`wdu-018` (Generation phase: vẽ nhiều ý tưởng)<br>`wdu-020` (Kỹ thuật Ideation) | `wdu-017` (Không cần vẽ đẹp $\leftarrow$ trùng `wdu-156`)<br>`wdu-019` (Không dừng ngay khi bí $\leftarrow$ phủ định `wdu-018`) |
| **1.3. Thị giác & Trí nhớ** *(10 câu)* | `wdu-021` (Central vision ~5°)<br>`wdu-022` (Quét mắt hình chữ F)<br>`wdu-023` (Hiệu ứng pop-out)<br>`wdu-024` (Proximity là Gestalt, không phải primitive)<br>`wdu-025` (Short-term memory ~7 items)<br>`wdu-026` (Schema trong long-term memory)<br>`wdu-027` (Accuracy không ảnh hưởng recall)<br>`wdu-028` (Short-term memory giữ vài giây) | `wdu-029` (Giữ danh sách ngắn $\leftarrow$ từ `wdu-025`, `wdu-028`)<br>`wdu-030` (Consistency/standards tận dụng schema $\leftarrow$ từ `wdu-026`) | *(Không có câu trùng trực tiếp)* |
| **1.4. Don Norman & 10 Heuristics của Nielsen** *(18 câu)* | `wdu-031` (Thứ tự 6 bước: EBDFAC)<br>`wdu-032` (Gulf of Execution — giải thích nêu cả Gulf of Evaluation)<br>`wdu-034` (Affordance)<br>`wdu-035` (Signifier — giải thích nêu cả Feedback)<br>`wdu-037` (Constraints)<br>`wdu-038` (Conceptual models)<br>`wdu-041` (Instantaneous = 100 ms)<br>`wdu-045` (Direct manipulation $\to$ Recognition over recall) | `wdu-039` (10 heuristics là rules of thumb, không chỉ định chi tiết mọi màn hình)<br>`wdu-040` (Mã tối nghĩa vi phạm Match real world)<br>`wdu-042` (Trial & error $\to$ Undo/Redo)<br>`wdu-044` (In-process feedback $\to$ Error prevention)<br>`wdu-046` (Flexibility $\to$ keyboard shortcuts)<br>`wdu-047` (Minimalist design $\to$ dễ tìm thông tin)<br>`wdu-048` (Help không viết theo góc nhìn dev) | `wdu-033` (Gulf of Evaluation $\leftarrow$ ghi rõ trong `wdu-032`)<br>`wdu-036` (Feedback $\leftarrow$ ghi rõ trong `wdu-035`)<br>`wdu-043` (Platform standards tận dụng schema $\leftarrow$ trùng `wdu-030`) |

- **Danh sách `Lazy Max` Course 1 (22 câu):**
  `wdu-001`, `wdu-006`, `wdu-008`, `wdu-013`, `wdu-014`, `wdu-016`, `wdu-021`, `wdu-022`, `wdu-023`, `wdu-024`, `wdu-025`, `wdu-026`, `wdu-027`, `wdu-028`, `wdu-031`, `wdu-032`, `wdu-034`, `wdu-035`, `wdu-037`, `wdu-038`, `wdu-041`, `wdu-045`.
- **Danh sách `Lazy` Course 1 (41 câu):** Gồm **22 câu trên** + **19 câu**:
  `wdu-003`, `wdu-004`, `wdu-005`, `wdu-007`, `wdu-009`, `wdu-011`, `wdu-012`, `wdu-015`, `wdu-018`, `wdu-020`, `wdu-029`, `wdu-030`, `wdu-039`, `wdu-040`, `wdu-042`, `wdu-044`, `wdu-046`, `wdu-047`, `wdu-048`.

---

### 2. Course 2: Understanding User Needs — *Tổng: 50 câu*
- **Lazy:** Giữ **37 câu** / Rút **13 câu** *(-26.0%)*.
- **Lazy Max:** Giữ **17 câu** / Rút **33 câu** *(-66.0%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (17 câu)** | **Lazy — Giữ thêm (20 câu)** *(Suy được từ Lazy Max)* | **Rút gọn ngay từ Lazy (13 câu)** *(Trùng / cùng 1 quy tắc)* |
| :--- | :--- | :--- | :--- |
| **2.1. Needs Assessment, Định tính & Scope** *(10 câu)* | `wdu-050` (Làm trước thiết kế mới & trước re-design)<br>`wdu-053` (3 quan hệ giữa Qualitative & Quantitative)<br>`wdu-055` (Quy tắc chọn phạm vi dự án vừa tầm: tính năng spell-check Word) | `wdu-049` (So sánh 2 phiên bản không phải needs assessment $\leftarrow$ từ `wdu-050`)<br>`wdu-052` (Phỏng vấn Excel là qualitative $\leftarrow$ từ `wdu-053`)<br>`wdu-054` (Câu hỏi mở phù hợp qualitative $\leftarrow$ từ `wdu-053`) | `wdu-051` (3 bước khóa học $\leftarrow$ trùng `wdu-094`)<br>`wdu-056`, `wdu-057`, `wdu-058` (Cả 3 câu cùng 1 quy tắc chọn Scope vừa tầm với `wdu-055`) |
| **2.2. Semi-Structured Interview & Protocol** *(15 câu)* | `wdu-059` (Individual, in-person, semi-structured)<br>`wdu-061` (Protocol là khung gợi ý, hay go off-script)<br>`wdu-062` (Overarching question giữ trọng tâm xuyên suốt)<br>`wdu-065` (Sau core questions: cluster + thêm follow-up)<br>`wdu-067` (3 lỗi câu hỏi "undo": leading, closed-ended, judgmental)<br>`wdu-068` (Guideline tốt: Memorize protocol)<br>`wdu-070` (Phỏng vấn bán cấu trúc giống chơi nhạc jazz) | `wdu-060` (Contextual inquiry: đúng user, nơi, thời điểm)<br>`wdu-063` (Mở đầu không kể có bao nhiêu ứng viên khác)<br>`wdu-064` (Câu hỏi mở tốt: kể lần dùng GPS gần nhất $\leftarrow$ đối lập `wdu-067`)<br>`wdu-069` (Không kể lời người tham gia khác khi tạo rapport)<br>`wdu-071` (Chú ý câu trả lời bất ngờ)<br>`wdu-073` (Không có 1 cách ghi chép duy nhất đúng) | `wdu-066` (Trùng nguyên văn câu hỏi lỗi "undo" với `wdu-067`)<br>`wdu-072` (Luôn nhớ overarching question $\leftarrow$ trùng 100% `wdu-062`) |
| **2.3. Observation, Think-Aloud & Affinity Wall** *(15 câu)* | `wdu-075` (Think-aloud: nhắc user nói thành tiếng bằng câu hỏi ngắn)<br>`wdu-078` (Carnegie Hall joke: practice is essential)<br>`wdu-083` (Condensing information is understanding)<br>`wdu-084` (Affinity wall dùng affinity notes, không bắt buộc dán lên tường thật) | `wdu-074` (Chú ý bối cảnh, ngập ngừng, bình luận khi quan sát)<br>`wdu-076`, `wdu-077` (Affinity note ngắn gọn, không giải thích dài dòng)<br>`wdu-079`, `wdu-080`, `wdu-081` (Qualitative analysis: clustering, tìm pattern)<br>`wdu-085`, `wdu-086`, `wdu-087`, `wdu-088` (Sẵn sàng gom lại cụm, tóm tắt cân bằng, tách "burning toast/fingers") | `wdu-082` (Gom thông tin liên quan $\leftarrow$ nằm trọn trong `wdu-081`, `wdu-085`) |
| **2.4. Tổng kết Course 2** *(10 câu)* | `wdu-092` (Tên khác Affinity wall: The KJ Method)<br>`wdu-093` (Không phải tên khác: Socio-technical extraction)<br>`wdu-094` (Không học trong khóa: Coding of qualitative texts) | `wdu-091` (Human-centered = tập trung vào nhu cầu, góc nhìn người dùng) | `wdu-089` (Tên khóa học)<br>`wdu-090`, `wdu-095` (Trùng `wdu-059`, `wdu-061`)<br>`wdu-096` (Tổng hợp từ `wdu-079`, `wdu-083`)<br>`wdu-097` (Trùng `wdu-075`)<br>`wdu-098` (Trùng 100% `wdu-078`) |

- **Danh sách `Lazy Max` Course 2 (17 câu):**
  `wdu-050`, `wdu-053`, `wdu-055`, `wdu-059`, `wdu-061`, `wdu-062`, `wdu-065`, `wdu-067`, `wdu-068`, `wdu-070`, `wdu-075`, `wdu-078`, `wdu-083`, `wdu-084`, `wdu-092`, `wdu-093`, `wdu-094`.
- **Danh sách `Lazy` Course 2 (37 câu):** Gồm **17 câu trên** + **20 câu**:
  `wdu-049`, `wdu-052`, `wdu-054`, `wdu-060`, `wdu-063`, `wdu-064`, `wdu-069`, `wdu-071`, `wdu-073`, `wdu-074`, `wdu-076`, `wdu-077`, `wdu-079`, `wdu-080`, `wdu-081`, `wdu-085`, `wdu-086`, `wdu-087`, `wdu-088`, `wdu-091`.

---

### 3. Course 3: Evaluating Designs with Users — *Tổng: 40 câu*
- **Lazy:** Giữ **36 câu** / Rút **4 câu** *(-10.0%)*.
- **Lazy Max:** Giữ **14 câu** / Rút **26 câu** *(-65.0%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (14 câu)** | **Lazy — Giữ thêm (22 câu)** *(Suy được từ Lazy Max)* | **Rút gọn ngay từ Lazy (4 câu)** *(Trùng / có sẵn trong giải thích)* |
| :--- | :--- | :--- | :--- |
| **3.1. Phân loại User Test & Dữ liệu** *(10 câu)* | `wdu-099` (Formative test: tìm lỗi trên pre-release prototype)<br>`wdu-100` (Benchmark test: chứng minh ngưỡng 99% dưới 1 phút)<br>`wdu-102` (Critical incidents & verbal reports = Qualitative)<br>`wdu-106` (Quan trọng nhất trong formative test: Critical incidents) | `wdu-101` (Không thu expected purchase price)<br>`wdu-103` (Không ẩn danh hai chiều tuyệt đối)<br>`wdu-104` (Định tính giải thích *tại sao* gặp khó khăn)<br>`wdu-105` (Task speed là objective, không phải subjective)<br>`wdu-107` (Questionnaires giải thích khác biệt kết quả)<br>`wdu-108` (Đo xem user làm được supported tasks không) | *(Không có câu trùng trực tiếp)* |
| **3.2. Tuyển người dùng & Thiết kế Task** *(8 câu)* | `wdu-109` (Recruiting criteria: "in" hay "out" — giải thích nêu cả Diversity criteria)<br>`wdu-111` (Mục tiêu user test Nomaza — Chọn A & C)<br>`wdu-113` (Well-designed task KHÔNG để mơ hồ suy diễn; cần realistic, verifiable, không lead the witness) | `wdu-110` (Diversity criteria $\leftarrow$ đối chiếu trong `wdu-109`)<br>`wdu-112` (Số giờ học tuần qua = Behavioral)<br>`wdu-114` (Chỉ từng bước = leads the witness $\leftarrow$ từ `wdu-113`)<br>`wdu-115` ("Find interesting course" = not verifiable $\leftarrow$ từ `wdu-113`)<br>`wdu-116` (Sắp xếp task từ dễ đến khó) | *(Không có câu trùng trực tiếp)* |
| **3.3. Bảng hỏi, Thiên lệch, Đạo đức & Điều phối** *(14 câu)* | `wdu-121` (SUS đo Perceived usability)<br>`wdu-123` (Demand characteristics: nói điều nghĩ ta muốn nghe)<br>`wdu-126` (Informed Consent)<br>`wdu-127` (Để user tự báo xong task, moderator không tự tuyên bố) | `wdu-118` (Dùng chung máy lab $\to$ không cần test laptop cá nhân)<br>`wdu-119` (Post-test questionnaire đo cảm nhận chủ quan định lượng)<br>`wdu-120` (QUIS/PSSUQ không đắt đỏ)<br>`wdu-122` (Không hỏi nhân khẩu học trong debrief)<br>`wdu-124` (Giảm confirmation bias bằng bên thứ 3 trung lập)<br>`wdu-125` (Người tham gia là partner tìm lỗi)<br>`wdu-128` (Không bắt buộc luôn có pre-test questionnaire)<br>`wdu-130` (Phòng test không cần chuyên biệt chỉ dùng cho test) | `wdu-117` (Think-Aloud Protocol $\leftarrow$ trùng 100% Ch2 `wdu-075`)<br>`wdu-129` (Không thông báo khi đạt success criteria $\leftarrow$ trùng `wdu-127`) |
| **3.4. Phòng lab, Vai trò & Báo cáo** *(8 câu)* | `wdu-132` (Moderator: người đón tiếp & giao tiếp suốt phiên)<br>`wdu-133` (Báo cáo nên có 5–10 key findings)<br>`wdu-134` (Báo cáo issue KHÔNG ghi tên thật người tham gia; ghi đủ mô tả, bằng chứng, severity, đề xuất) | `wdu-131` (Lab có phòng quan sát riêng để mời nhiều stakeholders)<br>`wdu-135` (Không bỏ trống recommendation)<br>`wdu-136` (Nên đưa baseline statistics vào báo cáo) | `wdu-137` (UX researcher gán severity $\leftarrow$ ghi trong `wdu-134`)<br>`wdu-138` (Vẫn cần screen recording dù ghi chép tốt $\leftarrow$ từ `wdu-129`) |

- **Danh sách `Lazy Max` Course 3 (14 câu):**
  `wdu-099`, `wdu-100`, `wdu-102`, `wdu-106`, `wdu-109`, `wdu-111`, `wdu-113`, `wdu-121`, `wdu-123`, `wdu-126`, `wdu-127`, `wdu-132`, `wdu-133`, `wdu-134`.
- **Danh sách `Lazy` Course 3 (36 câu):** Gồm **14 câu trên** + **22 câu**:
  `wdu-101`, `wdu-103`, `wdu-104`, `wdu-105`, `wdu-107`, `wdu-108`, `wdu-110`, `wdu-112`, `wdu-114`, `wdu-115`, `wdu-116`, `wdu-118`, `wdu-119`, `wdu-120`, `wdu-122`, `wdu-124`, `wdu-125`, `wdu-128`, `wdu-130`, `wdu-131`, `wdu-135`, `wdu-136`.

---

### 4. Course 4: UX Design: From Concept to Prototype — *Tổng: 60 câu*
- **Lazy:** Giữ **48 câu** / Rút **12 câu** *(-20.0%)*.
- **Lazy Max:** Giữ **16 câu** / Rút **44 câu** *(-73.3%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (16 câu)** | **Lazy — Giữ thêm (32 câu)** *(Suy được từ Lazy Max)* | **Rút gọn ngay từ Lazy (12 câu)** *(Trùng với Ch1 hoặc nội bộ Ch4)* |
| :--- | :--- | :--- | :--- |
| **4.1. Design Space, Formative & Ideation** *(20 câu)* | `wdu-144` (Design space = tập các phương án thiết kế thay thế)<br>`wdu-152` (Tradeoff analysis không phải phương pháp ideation)<br>`wdu-155` (Ideation sketch KHÔNG cần Refined) | `wdu-139` (Viết business plan không phải design skill)<br>`wdu-141` (Compromise = cân bằng tradeoffs)<br>`wdu-142` (Iterative loops: All)<br>`wdu-143`, `wdu-145` (Reframing & Problem scoping)<br>`wdu-146`, `wdu-147`, `wdu-148` (Formative research linh hoạt cả formal & informal)<br>`wdu-150`, `wdu-151`, `wdu-153` (Ideation nhanh, nhiều hơn 6 ý tưởng, lặp suốt dự án)<br>`wdu-154`, `wdu-157`, `wdu-158` (Sketching, facilitator, không chê lúc brainstorm) | `wdu-140` (Trùng 100% Ch1 `wdu-011`)<br>`wdu-149` (Trùng Ch1 `wdu-018`)<br>`wdu-156` (Trùng 100% Ch1 `wdu-017`) |
| **4.2. Personas, Scenarios, Storyboards & QOC** *(10 câu)* | `wdu-160` (Số lượng persona = số nhóm target users phân biệt)<br>`wdu-162` (Scenarios chuyển sang giải pháp bằng cách hình dung công nghệ đáp ứng nhu cầu)<br>`wdu-164` (Location KHÔNG phải thành phần chuẩn của scenario)<br>`wdu-168` (QOC: Criteria nêu điều kiện/ràng buộc) | `wdu-159` (Persona không thuần hư cấu $\leftarrow$ từ `wdu-160`)<br>`wdu-161` (Persona tập trung needs, barriers, motivations)<br>`wdu-165` (Storyboard trực quan môi trường & ràng buộc vật lý: All)<br>`wdu-167` (Hiếm khi hiển nhiên phương án tốt nhất $\leftarrow$ từ `wdu-168`) | `wdu-163` (Nằm trọn trong `wdu-162`)<br>`wdu-166` (Trùng `wdu-017`, `wdu-156`) |
| **4.3. Input, Output, State & Mode** *(10 câu)* | `wdu-170` (User-entered inputs: All except GPS — GPS là passive)<br>`wdu-173` (Olfactory không phải output modality phổ biến)<br>`wdu-176` ("Push" output căn chỉnh thời điểm tối ưu)<br>`wdu-177` (System state = giá trị tất cả inputs/variables + rules vận hành) | `wdu-171` (Tự chụp ảnh không phải passive input $\leftarrow$ từ `wdu-170`)<br>`wdu-172` (Granularity quan trọng với input)<br>`wdu-174` (Effective output cần biết info, context, knowledge base)<br>`wdu-175` ("Pull" output trao quyền kiểm soát cao $\leftarrow$ đối lập `wdu-176`)<br>`wdu-178` (Mode đổi đồng loạt nhiều hành vi hệ thống $\leftarrow$ từ `wdu-177`) | `wdu-169` (Nằm trọn trong `wdu-170`, `wdu-171`) |
| **4.4. Prototyping (Wireframe, Lo-fi, Hi-fi, Wizard of Oz)** *(10 câu)* | `wdu-182` (Wireframe KHÔNG nhằm kiểm tra "displayed content ordered correctly")<br>`wdu-185` (Lo-fi KHÔNG cần bao phủ toàn bộ chức năng hệ thống)<br>`wdu-188` (Wizard of Oz KHÔNG phù hợp nhất cho screen-based apps) | `wdu-180` (Prototypes test concept, chức năng, layout, tương tác: All)<br>`wdu-181` (Lo-fi vs Hi-fi cho loại feedback khác nhau)<br>`wdu-183` (Wireframe test concept & so sánh phương án)<br>`wdu-184`, `wdu-186` (Paper prototype dùng giấy/post-it, 1 người tự test được)<br>`wdu-187` (Hi-fi rất hữu ích cho usability testing) | `wdu-179` (Trùng Ch1 `wdu-004` & `wdu-180`) |
| **4.5. Affordance, Mental Model, Defaults & Social Effects** *(10 câu)* | `wdu-194` (Lý do thiết kế defaults: KHÔNG phải vì dễ thay đổi)<br>`wdu-195` (Social determinists vs Technical determinists) | `wdu-190` (Mental model không cần hiểu kỹ thuật bên dưới)<br>`wdu-197` (Cả 4 xu hướng công nghệ mới đều đổi cách prototype/test)<br>`wdu-198` (Quy trình UX cốt lõi không lỗi thời sau 1–2 năm) | `wdu-189` (Trùng Ch1 `wdu-034`)<br>`wdu-191`, `wdu-192` (Trùng 100% Ch1 `wdu-032`, `wdu-033`)<br>`wdu-193` (Trùng 100% `wdu-194`)<br>`wdu-196` (Technical determinists $\leftarrow$ ghi rõ trong `wdu-195`) |

- **Danh sách `Lazy Max` Course 4 (16 câu):**
  `wdu-144`, `wdu-152`, `wdu-155`, `wdu-160`, `wdu-162`, `wdu-164`, `wdu-168`, `wdu-170`, `wdu-173`, `wdu-176`, `wdu-177`, `wdu-182`, `wdu-185`, `wdu-188`, `wdu-194`, `wdu-195`.
- **Danh sách `Lazy` Course 4 (48 câu):** Gồm **16 câu trên** + **32 câu**:
  `wdu-139`, `wdu-141`, `wdu-142`, `wdu-143`, `wdu-145`, `wdu-146`, `wdu-147`, `wdu-148`, `wdu-150`, `wdu-151`, `wdu-153`, `wdu-154`, `wdu-157`, `wdu-158`, `wdu-159`, `wdu-161`, `wdu-165`, `wdu-167`, `wdu-171`, `wdu-172`, `wdu-174`, `wdu-175`, `wdu-178`, `wdu-180`, `wdu-181`, `wdu-183`, `wdu-184`, `wdu-186`, `wdu-187`, `wdu-190`, `wdu-197`, `wdu-198`.

---

### 5. Course 5: UX Design Concept & Capstone Case Studies — *Tổng: 15 câu*
- **Lazy:** Giữ **12 câu** / Rút **3 câu** *(-20.0%)*.
- **Lazy Max:** Giữ **7 câu** / Rút **8 câu** *(-53.3%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (7 câu)** | **Lazy — Giữ thêm (5 câu)** *(Suy được từ Course 1–4)* | **Rút gọn ngay từ Lazy (3 câu)** *(Trùng trực tiếp Course 2–4)* |
| :--- | :--- | :--- | :--- |
| **5.1. Capstone Case Studies & Attachments** *(15 câu)* | `wdu-202` (Case George bán đồ ăn dư — Chọn A, B, C)<br>`wdu-203` (Attachment #1: mục tiêu so sánh web tool vs Dropbox)<br>`wdu-204` (Attachment #1: bổ sung Test Script & Task instructions)<br>`wdu-208` (Vi phạm heuristic: User control and freedom)<br>`wdu-209` (Key tasks: Check map, Help, Activate "Robbery")<br>`wdu-211` (Hình mẫu: Hi-Fi Prototype)<br>`wdu-212` (Thứ tự fidelity thấp $\to$ cao: 1, 2, 3) | `wdu-199` (Câu hỏi needs-finding tốt — Chọn cả 4)<br>`wdu-205` (Key findings tốt: xếp ưu tiên + đề xuất khả thi)<br>`wdu-207` (Scope tốt: kiểm thử core functions)<br>`wdu-210` (Mọi loại prototype đều dùng test được)<br>`wdu-213` (Navigation flow tốt: chỉ rõ vị trí click chuyển màn) | `wdu-200` (Qualitative research $\leftarrow$ trùng Ch2 `wdu-052`, `wdu-054`)<br>`wdu-201` (Persona hiệu quả $\leftarrow$ trùng Ch4 `wdu-161`)<br>`wdu-206` (Issue report gồm Severity, Evidence, Description $\leftarrow$ trùng 100% Ch3 `wdu-134`) |

- **Danh sách `Lazy Max` Course 5 (7 câu):**
  `wdu-202`, `wdu-203`, `wdu-204`, `wdu-208`, `wdu-209`, `wdu-211`, `wdu-212`.
- **Danh sách `Lazy` Course 5 (12 câu):** Gồm **7 câu trên** + **5 câu**:
  `wdu-199`, `wdu-205`, `wdu-207`, `wdu-210`, `wdu-213`.

---

### 6. Course 6: UX Research at Scale: Surveys, Analytics, Online Testing — *Tổng: 61 câu*
- **Lazy:** Giữ **55 câu** / Rút **6 câu** *(-9.8%)*.
- **Lazy Max:** Giữ **26 câu** / Rút **35 câu** *(-57.4%)*.

| Cụm chủ đề | **Lazy Max — Câu trụ cột (26 câu)** | **Lazy — Giữ thêm (29 câu)** *(Suy được từ Lazy Max)* | **Rút gọn ngay từ Lazy (6 câu)** *(Trùng lặp 100%)* |
| :--- | :--- | :--- | :--- |
| **6.1. Nền tảng Survey & Sai số** *(9 câu)* | `wdu-214` (Thế mạnh Survey: Describing Opinions)<br>`wdu-216` (Population: toàn bộ tập người muốn đại diện)<br>`wdu-217` (Instrument: bộ câu hỏi thực tế)<br>`wdu-219` (Measurement error: câu hỏi không đo đúng khái niệm)<br>`wdu-221` (Đáp án bộ đề: Sampling error — bỏ sót nhóm lớn) | `wdu-215` (Không chạy exploratory survey để đi tìm UX goals)<br>`wdu-218` (Giảm sai số trong giới hạn nguồn lực)<br>`wdu-220` (Nonresponse error: từ chối trả lời) | `wdu-222` (Mô tả rộng chứ không đo chính xác $\leftarrow$ trùng 100% `wdu-214`) |
| **6.2. Sampling, Panel, MTurk & Tỷ lệ phản hồi** *(17 câu)* | `wdu-223` (Sampling Frame không phải loại sampling)<br>`wdu-225` (Probability sample: mọi thành viên đều có cơ hội được chọn)<br>`wdu-229` (Purposive sampling: hỏi người dùng giỏ hàng)<br>`wdu-231` (MTurk không cần bận tâm Response rates)<br>`wdu-232` (Social desirability bias: cố tỏ ra chuẩn mực trước người hỏi)<br>`wdu-236` (Social Exchange Theory: dùng trust làm nền tảng cân nhắc cost/benefit)<br>`wdu-238` (Ít đúng nhất về phần thưởng: càng nhiều tiền càng dễ tham gia) | `wdu-224` (Số câu hỏi không thuộc định nghĩa population)<br>`wdu-226` (Twitter không phải sampling frame $\leftarrow$ từ `wdu-223`)<br>`wdu-227` (Lý do chọn non-probability: Cost)<br>`wdu-228` (Random email sinh viên không phải convenience)<br>`wdu-230` (Lý do dùng panel: giảm chi phí tuyển)<br>`wdu-234`, `wdu-235` (Mẫu nhỏ phản hồi cao > mẫu lớn phản hồi thấp; không phải để chạy thống kê phức tạp)<br>`wdu-237` (Rút ngắn khảo sát là giảm burden, không phải tăng benefit) | `wdu-233` (Sampling frame không phải chiều của survey mode $\leftarrow$ từ `wdu-223`)<br>`wdu-239` (Ví dụ giỏ hàng là purposive sampling $\leftarrow$ trùng `wdu-229`) |
| **6.3. Thiết kế Câu hỏi khảo sát** *(20 câu)* | `wdu-244` (Question stem: phần dẫn cụ thể hóa khái niệm)<br>`wdu-245` (Nominal closed-ended: danh mục không có thứ tự)<br>`wdu-246` (Like–Dislike: Bipolar ordinal)<br>`wdu-249` (Quan trọng nhất chọn dạng câu hỏi: loại phân tích dữ liệu dự định)<br>`wdu-250` (Stem câu lưỡng cực phải chứa cả 2 cực)<br>`wdu-254` ("Don't Know": dùng cho recall, không dùng cho opinions)<br>`wdu-256` (Randomize KHÔNG nhằm giảm Cognitive burden)<br>`wdu-257` (Nominal KHÔNG nên ưu tiên "select all that apply" thay vì forced choice)<br>`wdu-258` (Agree/Disagree gây acquiescence bias) | `wdu-240` (Trí nhớ phai mờ, kém với routine actions)<br>`wdu-241` (Không cần mọi người trả lời giống nhau)<br>`wdu-242` (Khó operationalize khái niệm trừu tượng)<br>`wdu-243`, `wdu-251`, `wdu-252` (Open-ended khó phân tích, không chèn sau mọi câu đóng, vẫn giàu insight)<br>`wdu-247` (MCQ chọn 1 = Nominal closed-ended, choice forced $\leftarrow$ từ `wdu-245`)<br>`wdu-248` (Không viết nghe kiểu hàn lâm/khoa học)<br>`wdu-259` (Ordinal không dùng vague quantifiers) | `wdu-253` (Trùng 100% nguyên văn từng chữ với `wdu-243`)<br>`wdu-255` (Nominal là dạng phổ biến $\leftarrow$ từ `wdu-245`) |
| **6.4. Analytics, UX Maturity & Remote Testing** *(15 câu)* | `wdu-262` (4 dấu hiệu good research questions: Clarity, Answerable, Ethical, Significance — KHÔNG có Consistency)<br>`wdu-264` (Nhóm nhỏ 2–3 người: Feature-driven usability testing)<br>`wdu-266` (Optimization phase xem điều hướng số đông: Analytics Review)<br>`wdu-272` (Remote moderated: cần điều hướng, khó tuyển tại chỗ, xem digital context)<br>`wdu-274` (Chuẩn bị cho CẢ moderated & unmoderated: không gồm online sớm 10–15p) | `wdu-260` (Concept Testing không dùng giải thích *tại sao* dùng theo thời điểm)<br>`wdu-261` (Attitudes/needs: Interviews & Surveys)<br>`wdu-263` (Gắn kết stakeholders: dự test, video, email bullet, summary)<br>`wdu-265` (User stories: Personas, Scenarios, Journey Maps)<br>`wdu-267`, `wdu-269` (Research at scale làm ở mọi giai đoạn & mọi cấp UX maturity)<br>`wdu-270`, `wdu-271`, `wdu-273` (Remote testing khi đa vùng/ít thời gian; cả 4 tiêu chí nền tảng đều quan trọng; script không gồm hướng dẫn giải task) | `wdu-268` (Truyền đạt kết quả cho stakeholders $\leftarrow$ trùng 100% nguyên tắc với `wdu-263`) |

- **Danh sách `Lazy Max` Course 6 (26 câu):**
  `wdu-214`, `wdu-216`, `wdu-217`, `wdu-219`, `wdu-221`, `wdu-223`, `wdu-225`, `wdu-229`, `wdu-231`, `wdu-232`, `wdu-236`, `wdu-238`, `wdu-244`, `wdu-245`, `wdu-246`, `wdu-249`, `wdu-250`, `wdu-254`, `wdu-256`, `wdu-257`, `wdu-258`, `wdu-262`, `wdu-264`, `wdu-266`, `wdu-272`, `wdu-274`.
- **Danh sách `Lazy` Course 6 (55 câu):** Gồm **26 câu trên** + **29 câu**:
  `wdu-215`, `wdu-218`, `wdu-220`, `wdu-224`, `wdu-226`, `wdu-227`, `wdu-228`, `wdu-230`, `wdu-234`, `wdu-235`, `wdu-237`, `wdu-240`, `wdu-241`, `wdu-242`, `wdu-243`, `wdu-247`, `wdu-248`, `wdu-251`, `wdu-252`, `wdu-259`, `wdu-260`, `wdu-261`, `wdu-263`, `wdu-265`, `wdu-267`, `wdu-269`, `wdu-270`, `wdu-271`, `wdu-273`.
