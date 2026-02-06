import React from 'react'
import { assets } from '../assets/assets'
import { NavLink } from 'react-router-dom'

const Navbar = () => {
  return (
    <div className='flex item-center justify-between text-sm py-4 mb-5 border-b border-b-gray-400' >
      <img src={assets.logo} alt='' />
      <ul>
        <NavLink>
          <li>
            Home
          </li>
          <hr/>
        </NavLink>
        <NavLink>
          <li>
           All Doctors
          </li>
          <hr/>
        </NavLink>
        <NavLink>
          <li>
            About
          </li>
          <hr/>
        </NavLink>
        <NavLink>
          <li>
            Contact
          </li>
          <hr/>
        </NavLink>
      </ul>
<button>Crate Account</button>
    </div>
  )
}

export default Navbar