const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const list=(items,fn)=>items.map(fn).join('');
const button=(label,code,attributes='')=>`<button onclick="${code}" ${attributes}>${label}</button>`;
const options=(items,current)=>list(items,x=>`<option ${x===current?'selected':''}>${x}</option>`);
const player=()=>session.players[session.seat];
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cards(hand,selected=[],action='') {
    const suits=['♠','♥','♣','♦'], faces={11:'J',12:'Q',13:'K',14:'A'};
    return `<div class="cards">${list(hand,(card,i)=>{
        const suit=Math.floor(card/13),r=rank(card);
        const css='card '+(suit%2?'red ':'')+(selected.includes(i)?'selected':'');
        const value=card===null?'◆':(faces[r]||r)+suits[suit];
        return action?button(value,`${action}(${i})`,`class="${css}" aria-pressed="${selected.includes(i)}"`):
            `<span class="${css}">${value}</span>`;
    })}</div>`;
}
const state=()=>session.state;
function pokerScreen() {
    const s=state();
    const active=['pre','draw','post'].includes(s.phase);
    const hand=s.hand?cards(s.hand,s.selected,s.phase==='draw'?'selectCard':''):'';
    const deal=(s.cpuChips??200)<5?'CPU is busted.':player().chips<5?'You need $5 to ante.':'Ante: $5';
    return `<p>CPU · ${usd(s.cpuChips??200)}</p>${s.cpu?cards(active?Array(5).fill(null):s.cpu):''}
      <p>Pot · ${usd(s.pot??s.carry??0)}</p>${hand}
      ${active?(s.phase==='draw'?button('DRAW','drawPoker()'):
      button('FOLD',"pokerBet('fold')")+button(s.open?'CALL '+usd(s.open):'CHECK',"pokerBet('call')",
      player().chips<s.open?'disabled':'')+button('RAISE +$10',"pokerBet('raise')",
      player().chips<s.open+10||s.cpuChips<10?'disabled':'')):
      `<p>${deal}</p>`+button('DEAL','dealPoker()',player().chips<5||(s.cpuChips??200)<5?'disabled':'')}`;
}
function dealPoker() {
    const s=state();
    const d=deck(), chips=s.cpuChips??200;
    if(player().chips<5||chips<5) {s.message='The table is closed. Start a new session.';render();return;}
    cue('cards'); player().chips-=5;
    const cpu=d.splice(0,5), open=Math.min(chips-5,player().chips,pokerRank(cpu)[0]>0?10:0);
    session.state={phase:'pre',d,hand:d.splice(0,5),cpu,selected:[],pot:10+(s.carry||0)+open,
        cpuChips:chips-5-open,open,paid:5,soldItems:s.soldItems||0,message:open?'The CPU opens for '+usd(open)+'.':'The CPU checks.'};
    render();
}
function selectCard(index) {
    const s=state();
    if(s.selected.includes(index)) s.selected=s.selected.filter(x=>x!==index);
    else if(s.selected.length<3) s.selected.push(index);
    render();
}
function drawPoker() {
    const s=state();
    if(s.selected.length)cue('cards');
    for(const index of s.selected) s.hand[index]=s.d.pop();
    const category=pokerRank(s.cpu)[0];
    if(category<=1) {
        const ranks=s.cpu.map(rank);
        const targets=s.cpu.map((_,i)=>i).sort((a,b)=>ranks[a]-ranks[b])
            .filter(i=>ranks.filter(r=>r===ranks[i]).length===1).slice(0,3);
        for(const i of targets) s.cpu[i]=s.d.pop();
    }
    s.selected=[]; s.phase='post'; s.open=0; s.message='You open the final betting round.';
    render();
}
function pokerBet(action) {
    const s=state();
    if(action==='fold') {s.cpuChips+=s.pot; s.message='You folded.'; finishPoker(-s.paid);return;}
    const raise=action==='raise'?10:0, bet=s.open+raise;
    if(bet>player().chips||raise>s.cpuChips) return;
    if(bet)cue('chip');
    s.paid+=bet; player().chips-=bet; s.cpuChips-=raise; s.pot+=bet+raise;
    if(s.phase==='pre') {s.phase='draw';s.message='Select up to three cards to exchange.';render();return;}
    const result=compare(s.hand,s.cpu,settings.classic);
    if(result>0) {player().chips+=s.pot; s.message='You win the pot.';}
    else if(result<0) {s.cpuChips+=s.pot; s.message='The CPU wins the pot.';}
    else {s.carry=s.pot;s.message='Tie. The pot carries over.';}
    finishPoker((result>0?s.pot:0)-s.paid);
}
function finishPoker(net) {
    const s=state();
    s.pot=s.carry||0; s.phase='done'; record(net); render();
}

function stake(id='stake') {
    const amount=Number(document.querySelector('#'+id).value);
    if(!Number.isInteger(amount)||amount<1||amount>player().chips) {
        state().message='Choose a whole-dollar bet within your balance.'; render(); return 0;
    }
    return amount;
}
function betField(value=5) {return `<label>Bet ($) <input id="stake" type="number" min="1" value="${value}"></label>`;}
function blackjackScreen() {
    const s=state();
    if(!s.dealer||s.phase==='done') return (s.dealer?cards(s.dealer)+list(s.seats,(seat,i)=>
        `<p>${escapeHTML(session.players[i].name)} · ${seat?escapeHTML(seat.result):'Sat out'}</p>`):'')+betField()+button('DEAL','dealBlackjack()');
    const seat=s.seats[session.seat], hand=seat.hands[s.hand];
    const canDouble=hand.cards.length===2&&player().chips>=hand.bet;
    const equal=hand.cards.length===2&&Math.min(rank(hand.cards[0]),10)===Math.min(rank(hand.cards[1]),10)
        && (rank(hand.cards[0])===14)===(rank(hand.cards[1])===14);
    return `<h2>CPU DEALER</h2>${cards([s.dealer[0],null])}${cards(hand.cards)}
        <p>Hand ${s.hand+1} · ${blackjack(hand.cards)} · Bet ${usd(hand.bet)}</p>
        ${s.insuring?'<p>INSURANCE? · '+usd(hand.bet/2)+'</p>'+
        button('YES','insurance(true)',player().chips<hand.bet/2?'disabled':'')+button('NO','insurance(false)'):
        button('HIT',"blackjackAction('hit')")+button('STAND',"blackjackAction('stand')")+
        button('DOUBLE',"blackjackAction('double')",canDouble?'':'disabled')+
        button('SPLIT',"blackjackAction('split')",canDouble&&equal&&seat.hands.length===1?'':'disabled')}`;
}
function dealBlackjack() {
    const amount=Number(document.querySelector('#stake').value);
    if(!Number.isInteger(amount)||amount<1||!session.players.some(p=>p.chips>=amount)) {
        state().message='Choose a bet at least one player can cover.';render();return;
    }
    cue('cards');
    const d=deck(6);
    const dealer=[d.pop(),d.pop()];
    session.state={d,dealer,phase:'active',hand:0,insuring:rank(dealer[0])===14,seats:session.players.map(p=>{
        if(p.chips<amount)return null;
        p.chips-=amount;
        return {hands:[{cards:[d.pop(),d.pop()],bet:amount}],insurance:0};
    }),message:'All participating seats start with the same bet.'};
    session.seat=state().seats.findIndex(Boolean);
    if(state().insuring)render();else beginBlackjack();
}
function insurance(yes) {
    const s=state(), seat=s.seats[session.seat];
    if(yes) {
        seat.insurance=seat.hands[0].bet/2;
        player().chips-=seat.insurance;
    }
    const next=s.seats.findIndex((seat,i)=>seat&&i>session.seat);
    if(next>=0){session.seat=next;render();}
    else {s.insuring=false;beginBlackjack();}
}
function natural(hand) {return !hand.split&&hand.cards.length===2&&blackjack(hand.cards)===21;}
function beginBlackjack() {
    const s=state();
    if(blackjack(s.dealer)===21){settleBlackjack();return;}
    session.seat=s.seats.findIndex(Boolean);
    if(natural(s.seats[session.seat].hands[0])) advanceBlackjack();
    else render();
}
function blackjackAction(action) {
    const s=state(), seat=s.seats[session.seat], hand=seat.hands[s.hand];
    if(action!=='stand')cue(action==='split'?'cards':'card');
    if(action==='split') {
        player().chips-=hand.bet;
        const second=hand.cards.pop();
        hand.split=true;
        hand.cards.push(s.d.pop());
        seat.hands.push({cards:[second,s.d.pop()],bet:hand.bet,split:true});
        if(rank(second)===14){s.hand=1;advanceBlackjack();}else render();
        return;
    }
    if(action==='double'){player().chips-=hand.bet;hand.bet*=2;}
    if(action!=='stand') hand.cards.push(s.d.pop());
    if(action!=='hit'||blackjack(hand.cards)>=21) advanceBlackjack();
    else render();
}
function advanceBlackjack() {
    const s=state(), seat=s.seats[session.seat];
    if(s.hand+1<seat.hands.length){s.hand++;render();return;}
    const next=s.seats.findIndex((seat,i)=>seat&&i>session.seat&&!natural(seat.hands[0]));
    if(next>=0){session.seat=next;s.hand=0;render();return;}
    settleBlackjack();
}
function settleBlackjack() {
    const s=state(), dealerNatural=blackjack(s.dealer)===21;
    if(blackjack(s.dealer)<17)cue('card');
    while(blackjack(s.dealer)<17) s.dealer.push(s.d.pop());
    const total=blackjack(s.dealer);
    s.seats.forEach((seat,i)=>{
        if(!seat)return;
        let net=dealerNatural?seat.insurance*2:-seat.insurance;
        let returned=dealerNatural?seat.insurance*3:0;
        for(const hand of seat.hands) {
            const value=blackjack(hand.cards);
            let award=0;
            if(natural(hand)) award=dealerNatural?hand.bet:hand.bet*2.5;
            else if(!dealerNatural&&value<=21) award=total>21||value>total?hand.bet*2:value===total?hand.bet:0;
            returned+=award;net+=award-hand.bet;
        }
        session.players[i].chips+=returned;
        seat.result=(net>0?'+':'')+usd(net)+' · balance '+usd(session.players[i].chips);
        record(net);
    });
    session.seat=0;
    s.phase='done';s.message=dealerNatural?'Dealer blackjack.':'Dealer total: '+total;
    render();
}

const wheel=['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2'];
function rouletteScreen() {
    const s=state();
    const category=['Red','Black','Odd','Even','1–18','19–36','Dozen 1','Dozen 2','Dozen 3','Row 1','Row 2','Row 3'];
    const row=[...Array.from({length:36},(_,i)=>String(3*(i%12)+3-Math.floor(i/12)))];
    const betButton=n=>button(n,`addBet('${n}')`,`class="${Number(n)?redNumbers.includes(Number(n))?'redNumber':'blackNumber':''}"`);
    const pockets=list(wheel,(n,i)=>{
        const angle=i*360/38, color=Number(n)?redNumbers.includes(Number(n))?'#a31729':'#171719':'#177a46';
        return `<text x="110" y="28" text-anchor="middle" fill="${n===s.result?'#fff':'#ffe6af'}"
            stroke="${color}" stroke-width="12" paint-order="stroke" transform="rotate(${angle} 110 110)">${n}</text>`;
    });
    return `<svg role="img" aria-label="American roulette wheel" width="205" height="205" viewBox="0 0 220 220">
        <circle cx="110" cy="110" r="105" fill="#431825" stroke="#e8ae4f" stroke-width="5"/>
        <circle cx="110" cy="110" r="64" fill="#703517" stroke="#e8ae4f" stroke-width="3"/>
        <g font-size="10" font-weight="bold">${pockets}</g><text x="110" y="125" text-anchor="middle" fill="#ffdd89" font-size="41">${s.result??'◆'}</text></svg>
        <div>${betField(s.last||5)} ${betButton('0')}${betButton('00')}</div>
        <div class="grid">${list(row,betButton)}</div><div>${list(category,betButton)}</div>
        <p>${list(s.bets||[],b=>b.name+' · '+usd(b.amount)+' &nbsp; ')}</p>
        ${button('CLEAR BETS','clearBets()')}${button('SPIN','spinRoulette()',s.bets?.length?'':'disabled')}`;

}
function addBet(name) {
    const n=stake(), s=state();
    if(!n)return;
    if(n<5||n>500){s.message='Each roulette bet is $5–$500.';render();return;}
    s.bets??=[];
    if(s.bets.reduce((sum,b)=>sum+b.amount,0)+n>player().chips){
        s.message='Your queued bets exceed your dollar balance.';render();return;
    }
    cue('chip'); s.bets.push({name,amount:n});s.last=n;s.check=null;s.message='';render();
}
function clearBets(){if(state().bets?.length)cue('chip');state().bets=[];render();}
function spinRoulette() {
    const s=state();
    if (!s.bets?.length) return;
    if(s.bets.reduce((sum,b)=>sum+b.amount,0)>player().chips){s.message='Balance changed. Clear bets and place a smaller wager.';render();return;}
    cue('wheel'); s.result=wheel[roll(38)-1];s.check=null;
    const net=s.bets.reduce((sum,b)=>sum+b.amount*(roulettePayout(b.name,s.result)-1),0);
    player().chips+=net;
    s.bets=[];s.message='Result: '+s.result+' · '+(net>0?'+':'')+usd(net);
    record(net);render();
}
function slotsScreen() {
    const s=state();
    return `<div>${list(s.reels||['BAR','BELL','CHERRY'],x=>`<span class="reel">${x}</span>`)}</div>
        ${betField(s.last||5)} ${button('PULL LEVER','spinSlots()',s.phase==='loading'?'disabled':'')}`;
}
function spinSlots() {
    const n=stake(),s=state(),current=session;
    if(!n||s.phase==='loading')return;
    if(n>100){s.message='Maximum bet is $100.';render();return;}
    cue('reels'); s.last=n;s.phase='loading';s.reels=['◆','◆','◆'];s.message='Spinning…';
    s.pending=Array.from({length:3},()=>slots[roll(slots.length)-1]);
    render();
    revealSlots();
}
function revealSlots(){
    const s=state();
    s.pending.forEach((value,i)=>setTimeout(()=>{
        if(session.state!==s || session.finished) return;
        s.reels[i]=value; cue('stop');
        if(i===2){
            const net=s.last*slotsProfit(s.pending);
            player().chips+=net;
            s.phase='done'; s.message=s.pending.join(' · ');
            record(net);
        }
        render();
    },230*(i+1)));

}
function diceScreen(){
    const s=state();
    const faces=s.throwDice;
    return `<h2>Pass Line</h2><p>First roll: 7 or 11 wins; 2, 3 or 12 loses. Any other total becomes your point.</p>
      ${faces?`<div class="dice" aria-hidden="true">${faces.map(d=>'⚀⚁⚂⚃⚄⚅'[d-1]).join(' ')}</div>
      <strong>Last roll: ${faces[0]} + ${faces[1]} = ${faces[0]+faces[1]}</strong>`:''}
      <p>${s.point?'Point '+s.point+' · Roll '+s.point+' before a 7. Bet in play: '+usd(s.diceBet):betField(s.lastBet||5)}</p>
      ${button(s.point?'ROLL FOR '+s.point:'BET &amp; ROLL','rollPassLine()')}
      <p role="status">${escapeHTML(s.diceOutcome||'Wins pay 1:1.')}</p>
`;
}
function rollPassLine(){
    const s=state();
    if(!s.point){
        const bet=stake();
        if(!bet)return;
        s.diceBet=bet;s.lastBet=bet;player().chips-=bet;
        cue('chip');
    }
    s.practiceOpen=false;s.message='';
    cue('dice');
    s.throwDice=[roll(6),roll(6)];
    const total=s.throwDice[0]+s.throwDice[1];
    const win=s.point?total===s.point:total===7||total===11;
    const loss=s.point?total===7:[2,3,12].includes(total);
    if(win||loss){
        const bet=s.diceBet;
        if(win)player().chips+=2*bet;
        record(win?bet:-bet);
        s.diceOutcome=win?'You won '+usd(bet)+' profit. Bet returned.':'You lost '+usd(bet)+'.';
        s.point=0;s.diceBet=0;
    }else{
        s.point=s.point||total;
        s.diceOutcome='Your bet stays on the table. Roll again.';
    }
    render();
}
