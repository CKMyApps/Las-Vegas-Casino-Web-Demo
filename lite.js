'use strict';
const key='ckmyapps.lvcasino.web-lite.v1';
const settings={classic:true};
const screens={Poker:pokerScreen,Blackjack:blackjackScreen,Roulette:rouletteScreen,Slots:slotsScreen,Dice:diceScreen};
const app=document.getElementById('app');
const storeLink='<a class="buy" href="https://ckmyapps.itch.io/las-vegas-casino" target="_blank" rel="noopener">Buy the full game on itch.io ↗</a>';
const music=new Audio('audio/Lounge.mp3');
music.loop=true;music.volume=.22;
let muted=false, selecting=false, session=null, snapshot=null;
function cue(name){
    if(!muted)new Audio('audio/'+name+'.wav').play().catch(()=>{});
}
function toggleAudio(){
    muted=!muted;
    if(muted)music.pause();else music.play().catch(()=>{});
    render();
}
function restore(){
    try{snapshot=localStorage.getItem(key);session=JSON.parse(snapshot);}
    catch{app.textContent='Enable browser storage to play your free round.';return;}
    render();
    if(session?.game==='Slots' && !session.finished && state().phase==='loading')revealSlots();
}
function record(net){session.finished=true;session.net=net;}
function choose(game){
    if(session || !games.includes(game))return;
    session={game,seat:0,players:[{name:'Guest',chips:1000}],state:{message:''},finished:false};
    if(!muted)music.play().catch(()=>{});
    render();
}
function pick(){selecting=true;render();}
function render(){
    if(session){
        try{
            if(localStorage.getItem(key)!==snapshot){restore();return;}
            snapshot=JSON.stringify(session);localStorage.setItem(key,snapshot);
        }catch{app.textContent='Enable browser storage to play your free round.';return;}
    }
    const sound=button(muted?'Sound off':'Sound on','toggleAudio()');
    if(!session){
        app.innerHTML='<section class="welcome"><img src="cover.jpg" alt="Las Vegas Casino by CK My Apps"><div class="panel"><h1>Las Vegas Casino Lite</h1><p>Play one free round at any one of the five tables.</p>'+
        (selecting?'<h2>Choose your table</h2>'+list(games,g=>button(g,`choose('${g}')`)):button('New Game','pick()'))+
        '<div class="locked"><button disabled>Load Game</button><button disabled>Play Online</button></div>'+storeLink+'</div></section>';
        return;
    }
    const s=state();
    if(session.finished){
        const detail=session.game==='Dice'?(s.throwDice||[]).join(' + ')+' · '+s.diceOutcome:s.message;
        const summary=session.net>0?'You won '+usd(session.net):session.net<0?'You lost '+usd(-session.net):'Even round';
        app.innerHTML='<section class="welcome"><img src="cover.jpg" alt="Las Vegas Casino"><div class="panel"><h1>'+summary+'</h1><p>'+escapeHTML(detail||'')+'</p><h2>Your free round is complete.</h2><p>Get Las Vegas Casino for Mac to keep playing all five games.</p>'+storeLink+'</div></section>';
        music.pause();return;
    }
    app.innerHTML='<section class="page"><header><h1>'+session.game+'</h1>'+sound+'</header><div class="player">Guest · '+usd(player().chips)+' USD</div><section class="table">'+screens[session.game]()+'<p role="status">'+escapeHTML(s.message||'')+'</p></section></section>';
}
window.addEventListener('storage',e=>{if(e.key===key)restore();});
document.addEventListener('click',e=>{
    if(localStorage.getItem(key)!==snapshot){e.stopImmediatePropagation();e.preventDefault();restore();}
},true);
restore();
