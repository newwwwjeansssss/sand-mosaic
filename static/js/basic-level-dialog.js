// A small explicit starting point: no random generation and no writes until Save.
export function bindBasicLevelDialog({create,editable,error}){
  const get=id=>document.querySelector('#'+id),dialog=get('basic-level-dialog');
  const open=()=>{if(!editable())return;get('basic-error').textContent='';dialog.showModal();};
  get('add-level').onclick=open;
  get('basic-cancel').onclick=()=>dialog.close();
  get('basic-form').onsubmit=event=>{
    event.preventDefault();try{
      if(!editable())throw Error('请通过 start.exe 打开本地编辑器');
      create({name:get('basic-name').value,width:Number(get('basic-width').value),height:Number(get('basic-height').value),time:Number(get('basic-time').value),colorCount:Number(get('basic-colors').value),blank:get('basic-template').value==='blank'});
      dialog.close();
    }catch(e){get('basic-error').textContent=e.message;error(e);}
  };
}
