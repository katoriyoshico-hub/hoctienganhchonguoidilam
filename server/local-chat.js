// A small rule-based practice companion. This is not a generative AI model.
const topics = [
  ['identity', /\b(who are you|your name|are you (a |an )?(human|ai|bot))\b|ban la ai|ten ban/, [
    ["I'm this website's automatic English practice helper. I use simple topic-based replies. What would you like to talk about?",'Tôi là trợ lý luyện tiếng Anh tự động của website, trả lời đơn giản theo chủ đề. Bạn muốn nói chuyện gì?']]],
  ['goodbye', /\b(bye|goodbye|see you|good night)\b|tam biet/, [
    ['See you! Thanks for chatting. Come back whenever you want to practise.','Hẹn gặp lại! Cảm ơn bạn đã trò chuyện. Hãy quay lại khi muốn luyện tập.']]],
  ['thanks', /\b(thanks|thank you)\b|cam on/, [
    ["You're welcome! Is there anything else you'd like to talk about?",'Không có gì! Bạn còn muốn trò chuyện về điều gì không?']]],
  ['feelings', /\b(sad|tired|stress(ed)?|worried|lonely|upset|unhappy)\b|buon|met moi|lo lang/, [
    ["That sounds difficult. You can tell me more, or we can talk about something relaxing. What would you prefer?",'Nghe có vẻ khó khăn. Bạn có thể kể thêm hoặc nói về điều thư giãn. Bạn thích cách nào?'],
    ['What usually helps you relax after a difficult day?','Điều gì thường giúp bạn thư giãn sau một ngày khó khăn?']]],
  ['happy', /\b(happy|excited|great|wonderful|good day)\b|vui ve|rat vui/, [
    ["That's nice to hear! What made your day special?",'Rất vui khi nghe vậy! Điều gì khiến hôm nay của bạn đặc biệt?'],
    ['What would you like to do to celebrate?','Bạn muốn làm gì để ăn mừng?']]],
  ['work', /\b(work|job|office|busy|school|study|studying|student)\b|cong viec|di lam|di hoc/, [
    ['Tell me about your day at work or school. What was the most interesting part?','Hãy kể về ngày đi làm hoặc đi học của bạn. Phần nào thú vị nhất?'],
    ['What do you enjoy most about your work or studies?','Bạn thích nhất điều gì trong công việc hoặc việc học?']]],
  ['hobbies', /\b(hobby|hobbies|music|song|movie|film|game|gaming|reading|book|sport|football)\b|so thich|am nhac|bong da/, [
    ['That sounds like a fun topic! What do you enjoy most about it?','Chủ đề đó nghe thú vị! Bạn thích nhất điều gì ở nó?'],
    ['How often do you spend time on that hobby?','Bạn thường dành thời gian cho sở thích đó như thế nào?']]],
  ['travel', /\b(travel|trip|holiday|vacation|visit|beach|mountain)\b|du lich|ky nghi/, [
    ['Where would you like to go on your next trip?','Bạn muốn đi đâu trong chuyến đi tiếp theo?'],
    ['Do you prefer a relaxing trip or an adventure?','Bạn thích một chuyến đi thư giãn hay khám phá?']]],
  ['food', /\b(food|eat|eating|hungry|coffee|tea|drink|dinner|lunch|breakfast|cook|cooking)\b|do an|ca phe|nau an/, [
    ["What's your favourite food or drink?",'Món ăn hoặc thức uống yêu thích của bạn là gì?'],
    ['Do you like cooking at home or eating out?','Bạn thích nấu ăn ở nhà hay ăn bên ngoài?']]],
  ['weather', /\b(weather|rain|raining|sunny|hot|cold)\b|thoi tiet|troi mua/, [
    ["What's the weather like where you are today?",'Hôm nay thời tiết nơi bạn ở như thế nào?'],
    ['What do you like to do on a rainy day?','Bạn thích làm gì vào một ngày mưa?']]],
  ['greeting', /\b(hi|hello|hey|good morning|good afternoon|good evening|how are you)\b|xin chao/, [
    ["Hi! I'm ready to chat. How is your day going?",'Chào bạn! Tôi sẵn sàng trò chuyện. Hôm nay bạn thế nào?'],
    ["Hello again! What's on your mind today?",'Chào bạn lần nữa! Hôm nay bạn đang nghĩ về điều gì?']]],
];
const normalize = text => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
export function localChatReply({message,history=[]}) {
  const normalized=normalize(message);
  let topic=topics.find(t=>t[1].test(normalized));
  if(!topic && /^(yes|no|maybe|sometimes|often|really|ok|okay)[.! ]*$/i.test(message.trim())){
    const previous=history.filter(m=>m.role==='user').at(-1);
    if(previous)topic=topics.find(t=>t[1].test(normalize(previous.content)));
  }
  const replies=topic?.[2] || [
    ["Let's keep chatting. Would you like to tell me about your day or something you enjoy?",'Hãy trò chuyện tiếp nhé. Bạn muốn kể về hôm nay hoặc điều bạn yêu thích không?'],
    ['You can try a short sentence about work, food, travel or a hobby. Which one would you like to talk about?','Bạn có thể thử một câu ngắn về công việc, đồ ăn, du lịch hoặc sở thích. Bạn muốn nói về điều nào?'],
  ];
  const turn=history.filter(m=>m.role==='assistant').length;
  const [reply,translation]=replies[turn%replies.length];
  let correction='',tip='';
  const corrections=[
    [/\bi am agree\b/i,'I agree.','Dùng “I agree”, không dùng “I am agree”.'],
    [/\bi am boring\b/i,'I am bored.','Nếu muốn nói bạn thấy chán, dùng “bored”; “boring” nghĩa là gây chán.'],
  ];
  const fixed=corrections.find(c=>c[0].test(message));
  if(fixed){[,correction,tip]=fixed;}
  return {reply,translation,correction,tip};
}
