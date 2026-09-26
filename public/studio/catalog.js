const groups=['모두','매일 인사','가족과 축하','마음 전하기','계절과 명절','우리 모임'];
const occasions=[
['morning','매일 인사','☀','좋은 아침','오늘도 좋은 하루','아침 햇살처럼 따뜻한 일들이\n가득한 하루 보내세요.'],
['night','매일 인사','☾','편안한 밤','오늘도 수고했어요','하루의 걱정은 잠시 내려놓고\n편안하고 따뜻한 밤 보내세요.'],
['weekend','매일 인사','♧','즐거운 주말','행복한 주말 보내세요','좋아하는 사람들과 함께\n웃음 가득한 주말 보내세요.'],
['rain','매일 인사','☂','비 오는 날','비 오는 날의 안부','우산 꼭 챙기시고\n마음만큼은 맑은 하루 보내세요.'],
['birthday','가족과 축하','🎂','생일 축하','생일을 축하해요','당신이 있어 참 고맙습니다.\n오늘은 누구보다 행복하세요.'],
['grandchild','가족과 축하','🎈','손주 생일','사랑하는 너의 생일','밝게 웃으며 자라줘서 고마워.\n언제나 너를 사랑하고 응원해!'],
['anniversary','가족과 축하','♡','결혼기념일','함께한 날들이 선물','내 곁에 있어줘서 고마워요.\n앞으로도 서로 아끼며 함께해요.'],
['school','가족과 축하','✎','입학·졸업','새로운 시작을 응원해','너의 새로운 길에\n즐거운 배움과 좋은 만남이 가득하길!'],
['congrats','가족과 축하','✦','기쁜 일 축하','진심으로 축하합니다','정말 애쓰셨어요.\n앞으로도 좋은 일들이 가득하길 바랍니다.'],
['thanks','마음 전하기','💐','고마워요','마음을 담아 고마워요','보내주신 따뜻한 마음을\n오래오래 기억하겠습니다.'],
['miss','마음 전하기','♡','보고 싶어요','문득 당신이 생각나요','잘 지내고 계시지요?\n반가운 얼굴 마주할 날을 기다립니다.'],
['support','마음 전하기','✦','응원해요','당신을 응원합니다','서두르지 않아도 괜찮아요.\n당신의 걸음을 늘 응원합니다.'],
['sorry','마음 전하기','✉','미안해요','진심을 전합니다','내 마음을 잘 전하지 못했네요.\n미안한 마음을 이 글에 담습니다.'],
['comfort','마음 전하기','♧','위로를 전해요','당신 곁에 있을게요','어떤 말로도 다 헤아릴 수 없지만\n당신의 이야기를 듣고 싶어요.'],
['spring','계절과 명절','❀','봄 인사','꽃처럼 반가운 봄','따뜻한 봄바람과 함께\n기분 좋은 소식이 찾아오길 바랍니다.'],
['summer','계절과 명절','☀','여름 안부','시원한 여름 보내세요','더운 날 잠시 쉬어가며\n건강하고 즐거운 여름 보내세요.'],
['autumn','계절과 명절','🍂','가을 인사','가을의 마음을 전해요','선선한 바람처럼 기분 좋은\n가을날 보내시길 바랍니다.'],
['winter','계절과 명절','❄','겨울 안부','따뜻한 겨울 보내세요','추운 날 옷 따뜻하게 챙기시고\n마음까지 포근한 하루 보내세요.'],
['newyear','계절과 명절','✦','새해 인사','새해 복 많이 받으세요','새해에는 웃을 일이 더 많고\n소망하는 일들이 이루어지길 바랍니다.'],
['chuseok','계절과 명절','☾','추석 인사','풍성한 한가위','소중한 분들과 정을 나누는\n따뜻하고 풍성한 한가위 보내세요.'],
['reunion','우리 모임','♧','동창회 안내','반가운 얼굴을 만나요','오랜 친구들과 이야기 나눌 시간,\n반가운 마음으로 기다리겠습니다.'],
['walk','우리 모임','♧','산책·산악회','함께 걸어요','좋은 길을 함께 걸으며\n즐거운 추억을 만들어봐요.'],
['meal','우리 모임','☕','식사 초대','함께 식사해요','따뜻한 한 끼와 즐거운 이야기,\n함께할 수 있으면 좋겠습니다.'],
['travel','우리 모임','✈','여행 안내','함께 떠나는 즐거움','좋은 풍경 속에서\n우리의 새로운 추억을 만들어요.']
].map(([id,group,icon,label,title,message])=>({id,group,icon,label,title,message}));
const moods=[{id:'warm',label:'따뜻하게',color:'#155749',paper:'#fffdf5'},{id:'bright',label:'화사하게',color:'#824419',paper:'#fff7e3'},{id:'calm',label:'차분하게',color:'#243b61',paper:'#eff4fa'}];
function getOccasion(id){return occasions.find(o=>o.id===id)||occasions[0]}
function cardCopy(s){const o=getOccasion(s.occasion);return {recipient:s.recipient.trim()?s.recipient.trim()+' 님께':'소중한 당신께',title:s.title.trim()||o.title,message:s.message.trim()||o.message,sender:s.sender.trim()?s.sender.trim()+' 드림':'마음을 담아',details:[s.when.trim(),s.where.trim()].filter(Boolean).join(' · ')}}

const backgrounds=[
{id:'flowers',label:'꽃 편지',src:'assets/flowers.png',color:'#fffdf5'},
{id:'party',label:'축하 파티',src:'assets/party.png',color:'#fff1e3'},
{id:'coast',label:'바다 여행',src:'assets/coast.png',color:'#d9f1ff'},
{id:'comic',label:'장난 만화',src:'assets/comic.png',color:'#fff3bb'},
{id:'night',label:'밤의 감성',color:'#172744',color2:'#664b7a'},
{id:'plain',label:'깔끔한 단색',color:'#f5ede2'}];
const styles=[
{id:'normal',label:'깔끔하게',hint:'담백한 인사',bg:'plain',motion:'still',effect:'none',mood:'warm'},
{id:'warm',label:'따뜻하게',hint:'꽃과 마음',bg:'flowers',motion:'zoom',effect:'none',mood:'warm'},
{id:'funny',label:'장난스럽게',hint:'큰 자막과 통통 효과',bg:'comic',motion:'bounce',effect:'confetti',mood:'bright'},
{id:'party',label:'신나게',hint:'오늘의 주인공',bg:'party',motion:'sway',effect:'confetti',mood:'bright'},
{id:'cinema',label:'감성 영화',hint:'천천히 다가오는 사진',bg:'coast',motion:'zoom',effect:'sparkle',mood:'calm'},
{id:'retro',label:'추억 사진',hint:'흑백 사진과 한마디',bg:'night',motion:'zoom',effect:'none',mood:'calm'}];
groups.push('웃음과 장난');
occasions.push(...[
['coffee','☕','커피 사주세요','오늘도 열심히 살았다','칭찬은 됐고\n커피 한 잔이면 됩니다.'],
['star','😎','오늘의 주인공','오늘 주인공은 나야!','나이는 숫자일 뿐\n매력은 계속 업데이트 중.'],
['lazy','😴','쉬고 싶어요','오늘은 충전 중','급한 일은 내일의 나에게\n지금은 쉬는 게 내 일입니다.'],
['food','🍚','밥 먹자!','고민은 밥 먹고 하자','인생은 짧고\n맛있는 건 너무 많다!']
].map(([id,icon,label,title,message])=>({id,group:'웃음과 장난',icon,label,title,message})));
const templates=[
['morning','warm','flowers','따뜻한 아침','매일 인사','오늘도 좋은 하루','아침 햇살처럼 따뜻한 일들이\n가득한 하루 보내세요.'],
['night','cinema','night','밤의 안부','매일 인사','오늘도 참 수고했어요','오늘의 걱정은 잠시 내려놓고\n편안한 밤 보내세요.'],
['weekend','normal','coast','주말 여행 기분','매일 인사','마음도 쉬어가는 주말','좋은 풍경과 좋은 사람\n그것이면 충분한 주말.'],
['rain','normal','plain','비 오는 날 편지','매일 인사','우산은 챙기셨나요?','빗소리 듣는 오늘\n따뜻한 차 한 잔 하세요.'],
['birthday','party','party','생일 파티','가족과 축하','오늘은 당신의 날!','생일을 진심으로 축하해요\n웃음 가득한 하루 보내세요.'],
['grandchild','funny','comic','우리집 슈퍼스타','가족과 축하','우리집 슈퍼스타 탄생!','무럭무럭 자라줘서 고마워\n언제나 네 편이야!'],
['anniversary','cinema','night','우리의 영화','가족과 축하','너와 나의 이야기','함께한 날들이 모두 선물이야\n앞으로도 잘 부탁해.'],
['school','party','coast','새로운 출발','가족과 축하','너의 시작을 응원해','한 걸음씩 너답게\n멋진 내일을 만나길.'],
['congrats','normal','plain','정중한 축하','가족과 축하','진심으로 축하드립니다','뜻깊은 오늘을 함께 기뻐하며\n더 큰 행복을 기원합니다.'],
['thanks','warm','flowers','꽃보다 고마운 당신','마음 전하기','꽃보다 고마운 당신','보내주신 마음 덕분에\n오늘도 따뜻했습니다.'],
['miss','retro','night','추억 한 장','마음 전하기','그날이 생각나서','사진 한 장 꺼내보다\n문득 네가 보고 싶어졌어.'],
['support','party','comic','기운 충전','마음 전하기','당신의 배터리 100%','잘하고 있어요\n오늘도 힘껏 응원합니다!'],
['sorry','normal','plain','진심을 담아','마음 전하기','전하지 못했던 말','미안한 마음을 담아\n조심스레 인사를 전합니다.'],
['comfort','cinema','coast','잠시 쉬어가요','마음 전하기','조금 쉬어가도 괜찮아','서두르지 않아도 돼\n나는 늘 네 편이야.'],
['spring','warm','flowers','봄날의 초대','계절과 명절','우리 꽃 보러 갈까요?','봄바람이 좋아서\n당신과 걷고 싶어졌어요.'],
['summer','cinema','coast','여름 엽서','계절과 명절','바다 한 장 보냅니다','시원한 바람처럼\n기분 좋은 여름 보내세요.'],
['autumn','retro','plain','가을 감성','계절과 명절','좋은 계절, 좋은 안부','선선한 바람이 불어오니\n당신 생각이 납니다.'],
['newyear','party','party','새해 행운','계절과 명절','새해에는 더 행복하게','웃을 일은 더 많아지고\n걱정은 더 적어지길.'],
['chuseok','warm','flowers','한가위 인사','계절과 명절','마음 넉넉한 한가위','소중한 분들과 함께\n풍성한 명절 보내세요.'],
['reunion','retro','plain','동창회 초대장','우리 모임','우리 그때처럼 만나자','오랜 친구들과 웃고 떠들 시간\n반가운 마음으로 기다릴게.'],
['walk','cinema','coast','함께 걷는 날','우리 모임','좋은 길을 함께','사진도 찍고 이야기도 나누고\n우리 함께 걸어요.'],
['meal','party','party','맛있는 초대','우리 모임','밥 한 끼 같이해요','맛있는 음식에 반가운 얼굴\n함께하면 더 좋겠습니다.'],
['travel','cinema','coast','여행 출발!','우리 모임','우리의 여행이 시작된다','일상은 잠깐 내려놓고\n좋은 추억 만들러 가요.'],
['coffee','funny','comic','커피 뇌물 환영','웃음과 장난','칭찬 대신 커피 주세요','오늘도 열심히 살았습니다\n아이스든 핫이든 환영!'],
['star','funny','party','주인공 등장','웃음과 장난','오늘 주인공은 나야!','나이는 숫자일 뿐\n매력은 업데이트 중.'],
['lazy','funny','plain','공식 휴식 선언','웃음과 장난','오늘은 아무것도 안 함','게으른 게 아닙니다\n아주 적극적인 충전입니다.'],
['food','party','comic','밥부터 먹자','웃음과 장난','고민은 밥 먹고 하자','인생은 짧고\n맛있는 건 너무 많다!'],
['coffee','retro','night','엄근진 커피 요청','웃음과 장난','중요한 공지입니다','커피가 부족합니다\n신속한 지원 바랍니다.'],
['birthday','funny','comic','나이 비공개 생일','웃음과 장난','생일은 축하, 나이는 비밀','초는 적당히 꽂아주세요\n오늘도 청춘입니다!'],
['thanks','party','party','고마움 폭발','마음 전하기','고마움이 터집니다!','당신 덕분에 웃었어요\n이 마음 꼭 받아주세요.']
].map(([occasion,style,bg,label,group,title,message],i)=>({id:'template-'+i,occasion,style,bg,label,group,title,message}));
