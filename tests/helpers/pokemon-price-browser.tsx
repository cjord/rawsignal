import {createRoot} from 'react-dom/client';
import AccountProvider from '../../app/account/AccountProvider';
import PokemonPriceGame from '../../app/games/PokemonPriceGame';
createRoot(document.getElementById('fixture')!).render(<AccountProvider enabled><PokemonPriceGame/></AccountProvider>);
