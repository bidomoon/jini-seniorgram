export const plans = [
 {id:'image',name:'그림 친구',price:9900,description:'AI 그림과 인사 카드 만들기',video:false},
 {id:'video',name:'영상 친구',price:19900,description:'그림 만들기와 AI 동영상 만들기',video:true},
] as const;
export const trialImages = 3;
export const commercialCheckoutReady = false;
export function planFor(id:unknown){return plans.find(p=>p.id===id)}
export function verifyPayment(receipt:any, order:{id:string;account_id:string;amount:number;tid:string},cid:string){
 return receipt?.tid===order.tid&&receipt?.cid===cid&&receipt?.partner_order_id===order.id&&receipt?.partner_user_id===order.account_id&&receipt?.amount?.total===order.amount&&typeof receipt.sid==='string'&&receipt.sid.length>0;
}
