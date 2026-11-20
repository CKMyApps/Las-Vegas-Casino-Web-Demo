'use strict';
const games = ['Poker','Blackjack','Roulette','Slots','Dice'];
const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const slots = ['BAR','BELL','ORANGE','LEMON','PLUM','CHERRY'];
const roll = sides => Math.floor(Math.random()*sides)+1;

function deck(count=1) {
    const cards = Array.from({length:52*count}, (_,i)=>i%52);
    for (let i=cards.length-1;i>0;i--) {
        const j=roll(i+1)-1;
        [cards[i],cards[j]]=[cards[j],cards[i]];
    }
    return cards;
}
const rank = card => card%13+2;
function blackjack(cards) {
    let total=0, aces=0;
    for(const card of cards) {
        const value=rank(card);
        if(value===14) { total+=11; aces++; }
        else total+=Math.min(10,value);
    }
    while(total>21 && aces>0) { total-=10; aces--; }
    return total;
}
function pokerRank(cards) {
    const ranks=cards.map(rank).sort((a,b)=>b-a);
    const groups=[...new Set(ranks)].map(value=>[ranks.filter(r=>r===value).length,value])
        .sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
    const flush=cards.every(card=>Math.floor(card/13)===Math.floor(cards[0]/13));
    const straight=groups.length===5 && (ranks[0]-ranks[4]===4 ? ranks[0] :
        ranks.join(',')==='14,5,4,3,2' ? 5 : 0);
    const counts=groups.map(group=>group[0]).join('');
    const type=flush && straight ? 8 : counts==='41' ? 7 : counts==='32' ? 6 :
        flush ? 5 : straight ? 4 : counts==='311' ? 3 : counts==='221' ? 2 : counts==='2111' ? 1 : 0;
    return [type,...(straight ? [straight] : groups.map(group=>group[1]))];
}
function compare(a,b,classic=false) {
    const left=pokerRank(a), right=pokerRank(b);
    if(classic && left[0]===1 && right[0]===1) return 0;
    for(let i=0;i<left.length;i++) if(left[i]!==right[i]) return Math.sign(left[i]-right[i]);
    return 0;
}
function roulettePayout(bet,result) {
    if(bet===result) return 36;
    if(result==='0'||result==='00') return 0;
    const n=Number(result);
    const color=redNumbers.includes(n)?'Red':'Black';
    if([color,n%2?'Odd':'Even',n<=18?'1–18':'19–36'].includes(bet)) return 2;
    if(bet==='Dozen '+Math.ceil(n/12) || bet==='Row '+((n-1)%3+1)) return 3;
    return 0;
}
function slotsProfit(values) {
    if(new Set(values).size===1) return values[0]==='BAR'?101:11;
    const pair=values.find((value,index)=>values.indexOf(value)!==index);
    return pair ? pair==='BAR'?6:3 : -1;
}
